from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Diplo_messages(Base):
    __tablename__ = "diplo_messages"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_key = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    season = Column(String, nullable=False)
    from_nation = Column(String, nullable=False)
    to_nation = Column(String, nullable=False)
    intent = Column(String, nullable=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)