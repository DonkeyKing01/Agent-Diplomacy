import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.game_sessions import Game_sessions

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Game_sessionsService:
    """Service layer for Game_sessions operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Game_sessions]:
        """Create a new game_sessions"""
        try:
            obj = Game_sessions(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created game_sessions with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating game_sessions: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Game_sessions]:
        """Get game_sessions by ID"""
        try:
            query = select(Game_sessions).where(Game_sessions.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching game_sessions {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of game_sessionss"""
        try:
            query = select(Game_sessions)
            count_query = select(func.count(Game_sessions.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Game_sessions, field):
                        query = query.where(getattr(Game_sessions, field) == value)
                        count_query = count_query.where(getattr(Game_sessions, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Game_sessions, field_name):
                        query = query.order_by(getattr(Game_sessions, field_name).desc())
                else:
                    if hasattr(Game_sessions, sort):
                        query = query.order_by(getattr(Game_sessions, sort))
            else:
                query = query.order_by(Game_sessions.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching game_sessions list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Game_sessions]:
        """Update game_sessions"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Game_sessions {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated game_sessions {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating game_sessions {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete game_sessions"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Game_sessions {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted game_sessions {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting game_sessions {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Game_sessions]:
        """Get game_sessions by any field"""
        try:
            if not hasattr(Game_sessions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Game_sessions")
            result = await self.db.execute(
                select(Game_sessions).where(getattr(Game_sessions, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching game_sessions by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Game_sessions]:
        """Get list of game_sessionss filtered by field"""
        try:
            if not hasattr(Game_sessions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Game_sessions")
            result = await self.db.execute(
                select(Game_sessions)
                .where(getattr(Game_sessions, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Game_sessions.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching game_sessionss by {field_name}: {str(e)}")
            raise