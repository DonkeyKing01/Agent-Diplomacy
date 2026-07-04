from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Nation_agents(Base):
    __tablename__ = "nation_agents"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_key = Column(String, nullable=False)
    nation_id = Column(String, nullable=False)
    nation_name = Column(String, nullable=False)
    system_prompt = Column(String, nullable=True)
    skills_md = Column(String, nullable=True)
    memory = Column(String, nullable=True)
    annual_advice = Column(String, nullable=True)
    aggression = Column(Integer, nullable=True)
    loyalty = Column(Integer, nullable=True)
    cunning = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)