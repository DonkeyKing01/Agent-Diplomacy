import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.chronicles import Chronicles

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class ChroniclesService:
    """Service layer for Chronicles operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Chronicles]:
        """Create a new chronicles"""
        try:
            obj = Chronicles(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created chronicles with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating chronicles: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Chronicles]:
        """Get chronicles by ID"""
        try:
            query = select(Chronicles).where(Chronicles.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching chronicles {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of chronicless"""
        try:
            query = select(Chronicles)
            count_query = select(func.count(Chronicles.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Chronicles, field):
                        query = query.where(getattr(Chronicles, field) == value)
                        count_query = count_query.where(getattr(Chronicles, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Chronicles, field_name):
                        query = query.order_by(getattr(Chronicles, field_name).desc())
                else:
                    if hasattr(Chronicles, sort):
                        query = query.order_by(getattr(Chronicles, sort))
            else:
                query = query.order_by(Chronicles.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching chronicles list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Chronicles]:
        """Update chronicles"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Chronicles {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated chronicles {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating chronicles {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete chronicles"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Chronicles {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted chronicles {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting chronicles {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Chronicles]:
        """Get chronicles by any field"""
        try:
            if not hasattr(Chronicles, field_name):
                raise ValueError(f"Field {field_name} does not exist on Chronicles")
            result = await self.db.execute(
                select(Chronicles).where(getattr(Chronicles, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching chronicles by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Chronicles]:
        """Get list of chronicless filtered by field"""
        try:
            if not hasattr(Chronicles, field_name):
                raise ValueError(f"Field {field_name} does not exist on Chronicles")
            result = await self.db.execute(
                select(Chronicles)
                .where(getattr(Chronicles, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Chronicles.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching chronicless by {field_name}: {str(e)}")
            raise