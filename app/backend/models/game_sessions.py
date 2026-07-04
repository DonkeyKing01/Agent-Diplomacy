from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Game_sessions(Base):
    __tablename__ = "game_sessions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_key = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    season = Column(String, nullable=False)
    phase_index = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    provinces_json = Column(String, nullable=True)
    units_json = Column(String, nullable=True)
    sc_json = Column(String, nullable=True)
    nations_json = Column(String, nullable=True)
    last_orders_json = Column(String, nullable=True)
    pending_retreats_json = Column(String, nullable=True)
    governance_json = Column(String, nullable=True)
    engine = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
