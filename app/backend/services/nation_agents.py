import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.nation_agents import Nation_agents

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Nation_agentsService:
    """Service layer for Nation_agents operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Nation_agents]:
        """Create a new nation_agents"""
        try:
            obj = Nation_agents(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created nation_agents with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating nation_agents: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Nation_agents]:
        """Get nation_agents by ID"""
        try:
            query = select(Nation_agents).where(Nation_agents.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching nation_agents {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of nation_agentss"""
        try:
            query = select(Nation_agents)
            count_query = select(func.count(Nation_agents.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Nation_agents, field):
                        query = query.where(getattr(Nation_agents, field) == value)
                        count_query = count_query.where(getattr(Nation_agents, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Nation_agents, field_name):
                        query = query.order_by(getattr(Nation_agents, field_name).desc())
                else:
                    if hasattr(Nation_agents, sort):
                        query = query.order_by(getattr(Nation_agents, sort))
            else:
                query = query.order_by(Nation_agents.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching nation_agents list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Nation_agents]:
        """Update nation_agents"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Nation_agents {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated nation_agents {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating nation_agents {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete nation_agents"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Nation_agents {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted nation_agents {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting nation_agents {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Nation_agents]:
        """Get nation_agents by any field"""
        try:
            if not hasattr(Nation_agents, field_name):
                raise ValueError(f"Field {field_name} does not exist on Nation_agents")
            result = await self.db.execute(
                select(Nation_agents).where(getattr(Nation_agents, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching nation_agents by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Nation_agents]:
        """Get list of nation_agentss filtered by field"""
        try:
            if not hasattr(Nation_agents, field_name):
                raise ValueError(f"Field {field_name} does not exist on Nation_agents")
            result = await self.db.execute(
                select(Nation_agents)
                .where(getattr(Nation_agents, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Nation_agents.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching nation_agentss by {field_name}: {str(e)}")
            raise