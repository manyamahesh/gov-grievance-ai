def assign_department(message: str) -> str:
    message = message.lower()

    if "water" in message:
        return "Water Supply Department"
    elif "electricity" in message or "power" in message:
        return "Electricity Board"
    elif "road" in message:
        return "Public Works Department"
    elif "garbage" in message or "waste" in message:
        return "Sanitation Department"
    else:
        return "General Administration"
