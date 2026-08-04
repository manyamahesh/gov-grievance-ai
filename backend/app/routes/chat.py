import logging
from fastapi import APIRouter, HTTPException, Request, Depends, status
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
from typing import Optional, List, Dict, Any

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database.connection import conversations_collection, tickets_collection
from app.services.llm_service import analyze_grievance_async, normalize_llm_analysis, translate_text_async
from app.services.ticket_service import create_ticket
from app.dependencies.user_dependency import get_current_citizen
from app.dependencies.auth_dependency import verify_token

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class ChatRequest(BaseModel):
    message: Optional[str] = Field(None, max_length=2000, description="Citizen complaint or reply message")
    session_id: Optional[str] = Field(None, description="Existing chat session ID for multi-turn conversations")
    evidence_url: Optional[str] = Field(None, description="Optional photo or document evidence URL")
    selected_language: Optional[str] = Field(None, description="Citizen currently selected UI language")



class AdminReplyRequest(BaseModel):
    session_id: str = Field(..., description="Target grievance session ID")
    message: str = Field(..., min_length=1, max_length=2000, description="Admin reply message in English")


def make_grievance_ref(grievance_id: Optional[str]) -> str:
    """Format a clean citizen-facing grievance reference ID e.g. GR-9EC649F5."""
    if not grievance_id:
        return "GR-UNKNOWN"
    clean_id = str(grievance_id).replace("-", "")
    return f"GR-{clean_id[:8].upper()}"


@router.post("/chat", summary="Submit a complaint or conversation reply", description="Multi-turn LLM powered complaint analysis and intake endpoint requiring citizen login.")
@limiter.limit("15/minute")
async def chat_endpoint(
    request: Request,
    body: ChatRequest,
    current_user: dict = Depends(get_current_citizen)
):
    session_id = body.session_id or str(uuid.uuid4())
    now = datetime.utcnow()
    user_id = current_user["user_id"]

    # Retrieve all documents for this session
    existing_docs = list(conversations_collection.find({"session_id": session_id}).sort("created_at", 1))
    active_doc = existing_docs[-1] if existing_docs else None

    if active_doc:
        grievance_id = active_doc.get("grievance_id") or str(uuid.uuid4())
        messages = active_doc.get("messages", [])
        ticket_id = active_doc.get("ticket_id")
        agent_engaged = active_doc.get("agent_engaged", False)
        detected_lang = active_doc.get("detected_language", "English")
        conv_state = active_doc.get("conversation_state", "NEEDS_FOLLOWUP")
    else:
        grievance_id = str(uuid.uuid4())
        messages = []
        ticket_id = None
        agent_engaged = False
        detected_lang = "English"
        conv_state = "NEEDS_FOLLOWUP"

    grievance_ref = make_grievance_ref(grievance_id)

    raw_message = (body.message or "").strip()
    if not raw_message and not body.evidence_url:
        raise HTTPException(status_code=400, detail="Message or evidence image is required")

    user_content = raw_message if raw_message else "📷 [Photo Evidence Submitted]"
    if body.evidence_url and "[Evidence Uploaded:" not in user_content:
        user_content = f"{user_content}\n[Evidence Uploaded: {body.evidence_url}]"

    # CASE A: If human agent has taken over, pause AI bot auto-responses and log citizen follow-up for the admin
    if agent_engaged:
        translated_for_admin = await translate_text_async(
            user_content,
            target_language="English",
            source_language=detected_lang
        )

        user_msg = {
            "role": "user",
            "content": user_content,
            "evidence_url": body.evidence_url,
            "translated_content": translated_for_admin,
            "language": detected_lang,
            "read_by_admin": False,
            "read_by_citizen": True,
            "timestamp": now
        }
        messages.append(user_msg)


        update_payload = {
            "grievance_id": grievance_id,
            "grievance_ref": grievance_ref,
            "session_id": session_id,
            "user_id": user_id,
            "messages": messages,
            "conversation_state": "AGENT_HANDOFF",
            "read_by_admin": False,
            "read_by_citizen": True,
            "needs_agent_attention": True,
            "updated_at": datetime.utcnow()
        }

        conversations_collection.update_one(
            {"grievance_id": grievance_id},
            {"$set": update_payload}
        )

        if ticket_id:
            tickets_collection.update_one(
                {"ticket_id": ticket_id},
                {"$set": {"read_by_admin": False, "needs_agent_attention": True, "updated_at": datetime.utcnow()}}
            )
        target_lang = body.selected_language or (active_doc.get("selected_language") if active_doc else None) or detected_lang
        handoff_reply_en = "Your message has been sent directly to your assigned support agent."
        handoff_reply_trans = await translate_text_async(
            handoff_reply_en,
            target_language=target_lang,
            source_language="English"
        )

        return {
            "session_id": session_id,
            "grievance_id": grievance_id,
            "grievance_ref": grievance_ref,
            "user_id": user_id,
            "detected_language": detected_lang,
            "translated_text": active_doc.get("translated_text", user_content),
            "sentiment": active_doc.get("sentiment", "neutral"),
            "priority": active_doc.get("priority", "MEDIUM"),
            "department": active_doc.get("department", "General Administration"),
            "needs_followup": False,
            "ticket_id": ticket_id,
            "reply": handoff_reply_trans or handoff_reply_en,
            "messages": messages,
            "conversation_state": "AGENT_HANDOFF",
            "agent_engaged": True,
            "assigned_agent": active_doc.get("assigned_agent")
        }


    # CASE B: If grievance intake was ALREADY COMPLETED (Continue Chat on completed grievance)
    # Do NOT re-run intake classification or generate new complaint.
    is_already_completed = (
        active_doc and (
            conv_state == "COMPLETED" or 
            (not active_doc.get("needs_followup", True) and len(messages) >= 2)
        )
    )

    if is_already_completed:
        translated_for_admin = await translate_text_async(
            user_content,
            target_language="English",
            source_language=detected_lang
        )

        user_msg = {
            "role": "user",
            "content": user_content,
            "translated_content": translated_for_admin,
            "language": detected_lang,
            "read_by_admin": False,
            "read_by_citizen": True,
            "timestamp": now
        }
        messages.append(user_msg)

        # Generate friendly follow-up acknowledgement in citizen's language
        ack_english = "Thanks, we've flagged this for a support agent — they'll follow up with you here shortly."
        ack_translated = await translate_text_async(
            ack_english,
            target_language=detected_lang,
            source_language="English"
        )

        assistant_msg = {
            "role": "assistant",
            "content": ack_translated,
            "language": detected_lang,
            "read_by_admin": True,
            "read_by_citizen": True,
            "timestamp": datetime.utcnow()
        }
        messages.append(assistant_msg)

        update_payload = {
            "grievance_id": grievance_id,
            "grievance_ref": grievance_ref,
            "session_id": session_id,
            "user_id": user_id,
            "messages": messages,
            "conversation_state": "COMPLETED",
            "needs_agent_attention": True,
            "read_by_admin": False,
            "read_by_citizen": True,
            "updated_at": datetime.utcnow()
        }

        conversations_collection.update_one(
            {"grievance_id": grievance_id},
            {"$set": update_payload}
        )

        if ticket_id:
            tickets_collection.update_one(
                {"ticket_id": ticket_id},
                {"$set": {"read_by_admin": False, "needs_agent_attention": True, "updated_at": datetime.utcnow()}}
            )

        return {
            "session_id": session_id,
            "grievance_id": grievance_id,
            "grievance_ref": grievance_ref,
            "user_id": user_id,
            "detected_language": detected_lang,
            "translated_text": active_doc.get("translated_text", user_content),
            "sentiment": active_doc.get("sentiment", "neutral"),
            "priority": active_doc.get("priority", "MEDIUM"),
            "department": active_doc.get("department", "General Administration"),
            "needs_followup": False,
            "ticket_id": ticket_id,
            "reply": ack_translated,
            "messages": messages,
            "conversation_state": "COMPLETED",
            "agent_engaged": False,
            "needs_agent_attention": True
        }

    # CASE C: Standard AI Intake Processing (New Complaint or Active Followup Question)
    user_msg = {
        "role": "user",
        "content": user_content,
        "evidence_url": body.evidence_url,
        "language": "pending",
        "read_by_admin": False,
        "read_by_citizen": True,
        "timestamp": now
    }
    messages.append(user_msg)

    raw_analysis = await analyze_grievance_async(messages)
    analysis = normalize_llm_analysis(raw_analysis)

    detected_lang = analysis["detected_language"]
    translated_text = analysis["translated_text"]
    sentiment = analysis["sentiment"]
    priority = analysis["priority"]
    department = analysis["department"]
    needs_followup = analysis["needs_followup"]
    followup_q = analysis["followup_question"]
    reply_text = analysis["reply_to_citizen"]

    messages[-1]["language"] = detected_lang

    # Target language resolution:
    req_selected = body.selected_language or (active_doc.get("selected_language") if active_doc else None)

    if req_selected and req_selected.lower().strip() not in ["english", "en"]:
        target_lang = req_selected
    elif detected_lang and detected_lang.lower().strip() not in ["english", "en"]:
        target_lang = detected_lang
    else:
        target_lang = req_selected or detected_lang or "English"

    logger.info(f"🌐 INTAKE TRANSLATION TRACE: target_lang='{target_lang}' (req_selected='{req_selected}', detected_lang='{detected_lang}')")

    needs_agent_attention = False
    conv_state = "NEEDS_FOLLOWUP" if needs_followup else "COMPLETED"

    if body.evidence_url:
        needs_followup = False
        conv_state = "AGENT_HANDOFF"
        needs_agent_attention = True

        img_ack_en = "Your image evidence has been received. A support agent will review it and follow up with you here shortly."
        if target_lang.lower().strip() not in ["english", "en"]:
            img_ack_trans = await translate_text_async(img_ack_en, target_language=target_lang, source_language="English")
            img_ack = img_ack_trans or img_ack_en
        else:
            img_ack = img_ack_en

        ref_text_en = f"Your grievance ID is {grievance_ref} — save this to track or follow up."
        if target_lang.lower().strip() not in ["english", "en"]:
            ref_text_trans = await translate_text_async(ref_text_en, target_language=target_lang, source_language="English")
            ref_text = ref_text_trans or ref_text_en
        else:
            ref_text = ref_text_en

        final_reply_content = f"{img_ack}\n\n📌 {ref_text}"
        assistant_content = f"{img_ack_en}\n\n📌 {ref_text_en}"
        translated_assistant_content = final_reply_content
    else:
        if not needs_followup:
            ref_text_en = f"Your grievance ID is {grievance_ref} — save this to track or follow up."
            if target_lang.lower().strip() not in ["english", "en"]:
                ref_text_trans = await translate_text_async(
                    ref_text_en,
                    target_language=target_lang,
                    source_language="English"
                )
                ref_text = ref_text_trans or ref_text_en
            else:
                ref_text = ref_text_en

            if grievance_ref not in reply_text:
                reply_text = f"{reply_text}\n\n📌 {ref_text}"

        assistant_content = followup_q if (needs_followup and followup_q) else reply_text

        # If assistant_content is in English but target_lang is non-English, translate it
        if target_lang.lower().strip() not in ["english", "en"] and detected_lang.lower().strip() in ["english", "en"]:
            translated_assistant_content = await translate_text_async(
                assistant_content,
                target_language=target_lang,
                source_language="English"
            )
        else:
            translated_assistant_content = assistant_content

        final_reply_content = translated_assistant_content or assistant_content

    logger.info(f"🌐 INTAKE ASSISTANT FINAL CONTENT for target_lang='{target_lang}': '{final_reply_content}'")

    assistant_msg = {
        "role": "assistant",
        "content": final_reply_content,
        "translated_content": translated_assistant_content,
        "original_english_content": assistant_content,
        "language": target_lang,
        "read_by_admin": True,
        "read_by_citizen": True,
        "timestamp": datetime.utcnow()
    }
    messages.append(assistant_msg)

    if not ticket_id:
        try:
            ticket_id = create_ticket(
                session_id=session_id,
                message=translated_text or user_content,
                language=detected_lang,
                sentiment=sentiment,
                priority=priority,
                department=department
            )
            logger.info(f"✅ Ticket created successfully: {ticket_id} for grievance {grievance_ref}")
        except Exception as t_err:
            logger.error(f"❌ Ticket creation failed for {grievance_ref}: {t_err}")

    selected_lang = body.selected_language or (active_doc.get("selected_language") if active_doc else None) or detected_lang

    update_payload = {
        "grievance_id": grievance_id,
        "grievance_ref": grievance_ref,
        "session_id": session_id,
        "user_id": user_id,
        "messages": messages,
        "detected_language": detected_lang,
        "selected_language": selected_lang,
        "translated_text": translated_text,
        "sentiment": sentiment,
        "priority": priority,
        "department": department,
        "needs_followup": needs_followup,
        "conversation_state": conv_state,
        "needs_agent_attention": needs_agent_attention,
        "ticket_id": ticket_id,
        "agent_engaged": False,
        "read_by_admin": False,
        "evidence_url": body.evidence_url or (active_doc.get("evidence_url") if active_doc else None),
        "updated_at": datetime.utcnow()
    }


    if not active_doc:
        update_payload["created_at"] = now
        conversations_collection.insert_one(update_payload)
    else:
        conversations_collection.update_one(
            {"grievance_id": grievance_id},
            {"$set": update_payload}
        )

    return {
        "session_id": session_id,
        "grievance_id": grievance_id,
        "grievance_ref": grievance_ref,
        "user_id": user_id,
        "detected_language": detected_lang,
        "selected_language": selected_lang,
        "translated_text": translated_text,
        "sentiment": sentiment,
        "priority": priority,
        "department": department,
        "needs_followup": needs_followup,
        "followup_question": followup_q,
        "ticket_id": ticket_id,
        "reply": final_reply_content,
        "messages": messages,
        "conversation_state": conv_state,
        "agent_engaged": False
    }



@router.post("/admin/reply", summary="Admin Direct Reply & Agent Handoff", description="Allows authenticated department or super admin to reply directly to a citizen's grievance with auto-translation.")
async def admin_reply(
    body: AdminReplyRequest,
    admin_user: dict = Depends(verify_token)
):
    session_docs = list(conversations_collection.find({"session_id": body.session_id}).sort("created_at", 1))
    if not session_docs:
        raise HTTPException(status_code=404, detail="Grievance session not found")

    target_doc = session_docs[-1]
    dept = target_doc.get("department", "General Administration")

    if admin_user.get("role") == "department_admin":
        user_dept = admin_user.get("department")
        if user_dept and user_dept != "All" and user_dept.lower() != dept.lower():
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. You can only manage grievances in '{user_dept}' department."
            )

    doc_selected = target_doc.get("selected_language")
    doc_detected = target_doc.get("detected_language")

    if doc_selected and doc_selected.lower().strip() not in ["english", "en"]:
        target_lang = doc_selected
    elif doc_detected and doc_detected.lower().strip() not in ["english", "en"]:
        target_lang = doc_detected
    else:
        target_lang = doc_selected or doc_detected or "English"

    logger.info(f"🌐 ADMIN REPLY TRACE: target_lang='{target_lang}' (doc_selected='{doc_selected}', doc_detected='{doc_detected}') for msg='{body.message}'")

    messages = target_doc.get("messages", [])
    agent_engaged = target_doc.get("agent_engaged", False)
    grievance_id = target_doc.get("grievance_id")
    ticket_id = target_doc.get("ticket_id")
    admin_name = admin_user.get("username", "Admin")

    translated_for_citizen = await translate_text_async(
        body.message,
        target_language=target_lang,
        source_language="English"
    )

    logger.info(f"🌐 ADMIN REPLY TRANSLATION RESULT for target_lang='{target_lang}': '{translated_for_citizen}'")


    is_non_english = target_lang.lower().strip() not in ["english", "en"]
    
    if is_non_english:
        if translated_for_citizen and translated_for_citizen.lower().strip() != body.message.lower().strip():
            translation_status = "success"
            final_translated_content = translated_for_citizen
        else:
            translation_status = "failed"
            final_translated_content = None
    else:
        translation_status = "success"
        final_translated_content = body.message

    if not agent_engaged:
        handoff_en = f"You are now connected with support agent ({admin_name})."
        handoff_translated = await translate_text_async(
            handoff_en,
            target_language=target_lang,
            source_language="English"
        )
        system_msg = {
            "role": "system",
            "content": handoff_translated or handoff_en,
            "sender_name": admin_name,
            "read_by_admin": True,
            "read_by_citizen": False,
            "timestamp": datetime.utcnow()
        }
        messages.append(system_msg)

    agent_msg = {
        "role": "agent",
        "content": body.message,
        "translated_content": final_translated_content,
        "translation_status": translation_status,
        "language": target_lang,
        "sender_name": admin_name,
        "read_by_admin": True,
        "read_by_citizen": False,
        "timestamp": datetime.utcnow()
    }
    messages.append(agent_msg)

    update_payload = {
        "messages": messages,
        "agent_engaged": True,
        "assigned_agent": admin_name,
        "conversation_state": "AGENT_HANDOFF",
        "read_by_admin": True,
        "read_by_citizen": False,
        "needs_agent_attention": False,
        "updated_at": datetime.utcnow()
    }

    # CRITICAL FIX: Update exact target document using grievance_id rather than generic session_id filter
    if grievance_id:
        conversations_collection.update_one(
            {"grievance_id": grievance_id},
            {"$set": update_payload}
        )
    else:
        conversations_collection.update_one(
            {"session_id": body.session_id},
            {"$set": update_payload}
        )

    if ticket_id:
        tickets_collection.update_one(
            {"ticket_id": ticket_id},
            {"$set": {
                "agent_engaged": True,
                "assigned_agent": admin_name,
                "read_by_admin": True,
                "read_by_citizen": False,
                "needs_agent_attention": False,
                "updated_at": datetime.utcnow()
            }}
        )

    return {
        "status": "success",
        "session_id": body.session_id,
        "agent_engaged": True,
        "assigned_agent": admin_name,
        "messages": messages
    }


class TranslateThreadRequest(BaseModel):
    target_language: str = Field(..., description="Target language label e.g. English, Kannada, Hindi")


@router.post("/conversation/{session_id}/translate-thread", summary="Translate entire conversation thread to target language with caching")
async def translate_conversation_thread(session_id: str, body: TranslateThreadRequest):
    all_docs = list(conversations_collection.find({"session_id": session_id}).sort("created_at", 1))
    if not all_docs:
        raise HTTPException(status_code=404, detail="Conversation session not found")

    target_lang = body.target_language.strip()
    is_target_english = target_lang.lower() in ["english", "en"]

    target_doc = all_docs[-1]
    grievance_id = target_doc.get("grievance_id")
    messages = target_doc.get("messages", [])

    updated_any = False

    for msg in messages:
        if "translations" not in msg or not isinstance(msg.get("translations"), dict):
            msg["translations"] = {}

        # If already cached in target_lang, skip LLM call
        if target_lang in msg["translations"] and msg["translations"][target_lang]:
            continue

        role = msg.get("role")
        content = msg.get("content", "")

        if is_target_english:
            if role == "user":
                translated_val = msg.get("translated_content") or content
            elif role == "assistant":
                translated_val = msg.get("original_english_content") or content
            elif role == "agent":
                translated_val = content
            elif role == "system":
                sender = msg.get("sender_name", "admin")
                translated_val = f"You are now connected with support agent ({sender})."
            else:
                translated_val = content
        else:
            source_text = content
            if role == "agent" or role == "system":
                source_text = content
            elif role == "assistant" and msg.get("original_english_content"):
                source_text = msg["original_english_content"]
            elif role == "user" and msg.get("translated_content"):
                source_text = msg["translated_content"]

            translated_val = await translate_text_async(
                source_text,
                target_language=target_lang,
                source_language="English"
            )

        if translated_val:
            msg["translations"][target_lang] = translated_val
            updated_any = True

    if updated_any:
        if grievance_id:
            conversations_collection.update_one(
                {"grievance_id": grievance_id},
                {"$set": {"messages": messages, "selected_language": target_lang}}
            )
        else:
            conversations_collection.update_one(
                {"session_id": session_id},
                {"$set": {"messages": messages, "selected_language": target_lang}}
            )

    return {
        "status": "success",
        "session_id": session_id,
        "target_language": target_lang,
        "messages": messages
    }


@router.post("/conversation/{session_id}/mark-read-admin", summary="Mark Conversation Read by Admin")

def mark_read_admin(session_id: str, admin_user: dict = Depends(verify_token)):
    conversations_collection.update_many(
        {"session_id": session_id},
        {"$set": {"read_by_admin": True, "needs_agent_attention": False}}
    )
    tickets_collection.update_many(
        {"session_id": session_id},
        {"$set": {"read_by_admin": True, "needs_agent_attention": False}}
    )
    return {"status": "success", "session_id": session_id}


@router.post("/conversation/{session_id}/mark-read-citizen", summary="Mark Conversation Read by Citizen")
def mark_read_citizen(session_id: str, current_user: dict = Depends(get_current_citizen)):
    conversations_collection.update_many(
        {"session_id": session_id, "user_id": current_user["user_id"]},
        {"$set": {"read_by_citizen": True}}
    )
    return {"status": "success", "session_id": session_id}


@router.get("/notifications/unread-counts", summary="Get Unread Notification Counts")
def get_unread_counts(
    current_citizen: Optional[dict] = Depends(get_current_citizen),
    admin_user: Optional[dict] = Depends(verify_token)
):
    """Returns unread notification counts for citizen and admin users."""
    citizen_unread = 0
    admin_unread = 0
    attention_needed = 0

    if current_citizen:
        user_id = current_citizen["user_id"]
        if hasattr(conversations_collection, "count_documents"):
            citizen_unread = conversations_collection.count_documents({
                "user_id": user_id,
                "read_by_citizen": False
            })

    if admin_user:
        dept = admin_user.get("department")
        dept_filter = {}
        if admin_user.get("role") == "department_admin" and dept and dept != "All":
            dept_filter = {"department": dept}

        if hasattr(conversations_collection, "count_documents"):
            admin_query = {"read_by_admin": False}
            admin_query.update(dept_filter)
            admin_unread = conversations_collection.count_documents(admin_query)

            attention_query = {"needs_agent_attention": True}
            attention_query.update(dept_filter)
            attention_needed = conversations_collection.count_documents(attention_query)

    return {
        "unread_citizen_count": citizen_unread,
        "unread_admin_count": admin_unread,
        "attention_needed_count": attention_needed
    }


@router.get("/my-grievances", summary="Get Current Citizen Grievances", description="Returns all logged grievances for the authenticated citizen user with full combined message history.")
def get_my_grievances(current_user: dict = Depends(get_current_citizen)):
    user_id = current_user["user_id"]
    if not hasattr(conversations_collection, "find"):
        return {"total": 0, "grievances": []}

    # Fetch all user documents sorted chronologically to group by session_id
    all_user_docs = list(conversations_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", 1))

    # Group documents by session_id to build unified full message history
    sessions_map: Dict[str, Dict[str, Any]] = {}
    for d in all_user_docs:
        s_id = d.get("session_id") or d.get("grievance_id")
        if not s_id:
            continue

        if s_id not in sessions_map:
            sessions_map[s_id] = {
                "grievance_id": d.get("grievance_id"),
                "grievance_ref": d.get("grievance_ref") or make_grievance_ref(d.get("grievance_id")),
                "session_id": s_id,
                "department": d.get("department", "General Administration"),
                "priority": d.get("priority", "MEDIUM"),
                "sentiment": d.get("sentiment", "neutral"),
                "detected_language": d.get("detected_language", "English"),
                "translated_text": d.get("translated_text"),
                "conversation_state": d.get("conversation_state", "COMPLETED"),
                "agent_engaged": d.get("agent_engaged", False),
                "assigned_agent": d.get("assigned_agent"),
                "needs_agent_attention": d.get("needs_agent_attention", False),
                "read_by_admin": d.get("read_by_admin", True),
                "read_by_citizen": d.get("read_by_citizen", True),
                "ticket_id": d.get("ticket_id"),
                "feedback": d.get("feedback"),
                "created_at": d.get("created_at"),
                "messages": []
            }

        # Update metadata from latest document in session
        sessions_map[s_id]["conversation_state"] = d.get("conversation_state", sessions_map[s_id]["conversation_state"])
        sessions_map[s_id]["agent_engaged"] = d.get("agent_engaged", sessions_map[s_id]["agent_engaged"])
        sessions_map[s_id]["assigned_agent"] = d.get("assigned_agent") or sessions_map[s_id]["assigned_agent"]
        sessions_map[s_id]["needs_agent_attention"] = d.get("needs_agent_attention", sessions_map[s_id]["needs_agent_attention"])
        sessions_map[s_id]["read_by_citizen"] = d.get("read_by_citizen", sessions_map[s_id]["read_by_citizen"])
        sessions_map[s_id]["read_by_admin"] = d.get("read_by_admin", sessions_map[s_id]["read_by_admin"])
        if d.get("ticket_id"):
            sessions_map[s_id]["ticket_id"] = d.get("ticket_id")

        msgs = d.get("messages", [])
        if msgs:
            sessions_map[s_id]["messages"] = msgs

    # Format result list sorted newest session first
    result = list(sessions_map.values())
    result.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)

    for item in result:
        ticket_id = item.get("ticket_id")
        grievance_status = "RECEIVED — UNDER REVIEW"
        if ticket_id:
            ticket_doc = tickets_collection.find_one({"ticket_id": ticket_id})
            if ticket_doc:
                grievance_status = ticket_doc.get("status", "OPEN")
        item["status"] = grievance_status

    return {
        "total": len(result),
        "grievances": result
    }


@router.get("/conversation/{session_id}", summary="Get conversation history", description="Retrieves full conversation history and true ticket lifecycle status by session ID")
def get_conversation(session_id: str):
    all_docs = list(conversations_collection.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1))

    if not all_docs:
        raise HTTPException(status_code=404, detail="Conversation session not found")

    combined_messages = []
    latest_doc = all_docs[-1]
    
    for doc in all_docs:
        msgs = doc.get("messages", [])
        if not msgs and "message" in doc:
            msgs = [{
                "role": "user",
                "content": doc["message"],
                "language": doc.get("language", "English"),
                "timestamp": doc.get("timestamp")
            }]
        if len(msgs) > len(combined_messages):
            combined_messages = msgs

    ticket_id = latest_doc.get("ticket_id")
    grievance_status = "RECEIVED — UNDER REVIEW"
    if ticket_id:
        ticket_doc = tickets_collection.find_one({"ticket_id": ticket_id})
        if ticket_doc:
            grievance_status = ticket_doc.get("status", "OPEN")

    conv_state = latest_doc.get("conversation_state") or latest_doc.get("status") or "COMPLETED"
    g_id = latest_doc.get("grievance_id")
    g_ref = latest_doc.get("grievance_ref") or make_grievance_ref(g_id)

    return {
        "session_id": session_id,
        "grievance_id": g_id,
        "grievance_ref": g_ref,
        "total_messages": len(combined_messages),
        "detected_language": latest_doc.get("detected_language", "English"),
        "sentiment": latest_doc.get("sentiment", "neutral"),
        "priority": latest_doc.get("priority", "MEDIUM"),
        "department": latest_doc.get("department", "General Administration"),
        "status": grievance_status,
        "conversation_state": conv_state,
        "agent_engaged": latest_doc.get("agent_engaged", False),
        "assigned_agent": latest_doc.get("assigned_agent"),
        "needs_agent_attention": latest_doc.get("needs_agent_attention", False),
        "read_by_admin": latest_doc.get("read_by_admin", True),
        "read_by_citizen": latest_doc.get("read_by_citizen", True),
        "needs_followup": latest_doc.get("needs_followup", False),
        "ticket_id": ticket_id,
        "feedback": latest_doc.get("feedback"),
        "messages": combined_messages,
        "conversations": all_docs
    }
