from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Chronicles(Base):
    __tablename__ = "chronicles"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_key = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    summary = Column(String, nullable=False)
    sc_snapshot_json = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)