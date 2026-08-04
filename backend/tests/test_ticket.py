from datetime import datetime, timedelta
from app.services.ticket_service import compute_sla_deadline


def test_sla_deadline_calculation():
    now = datetime.utcnow()

    high_sla = compute_sla_deadline("HIGH", now)
    assert high_sla == now + timedelta(hours=24)

    med_sla = compute_sla_deadline("MEDIUM", now)
    assert med_sla == now + timedelta(hours=48)

    low_sla = compute_sla_deadline("LOW", now)
    assert low_sla == now + timedelta(hours=72)
