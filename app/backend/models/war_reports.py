from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class War_reports(Base):
    __tablename__ = "war_reports"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_key = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    season = Column(String, nullable=False)
    phase_index = Column(Integer, nullable=True)
    headline = Column(String, nullable=True)
    body = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)