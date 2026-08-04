def assign_priority(val: str) -> str:
    """Assign priority based on sentiment or raw priority string."""
    val_upper = str(val).upper()
    if val_upper in ["HIGH", "MEDIUM", "LOW"]:
        return val_upper
    
    val_lower = str(val).lower()
    if val_lower in ["negative", "high"]:
        return "HIGH"
    elif val_lower in ["positive", "low"]:
        return "LOW"
    else:
        return "MEDIUM"
