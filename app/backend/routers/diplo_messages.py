import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.diplo_messages import Diplo_messagesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/diplo_messages", tags=["diplo_messages"])


# ---------- Pydantic Schemas ----------
class Diplo_messagesData(BaseModel):
    """Entity data schema (for create/update)"""
    session_key: str
    year: int
    season: str
    from_nation: str
    to_nation: str
    intent: str = None
    content: str


class Diplo_messagesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    session_key: Optional[str] = None
    year: Optional[int] = None
    season: Optional[str] = None
    from_nation: Optional[str] = None
    to_nation: Optional[str] = None
    intent: Optional[str] = None
    content: Optional[str] = None


class Diplo_messagesResponse(BaseModel):
    """Entity response schema"""
    id: int
    session_key: str
    year: int
    season: str
    from_nation: str
    to_nation: str
    intent: Optional[str] = None
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Diplo_messagesListResponse(BaseModel):
    """List response schema"""
    items: List[Diplo_messagesResponse]
    total: int
    skip: int
    limit: int


class Diplo_messagesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Diplo_messagesData]


class Diplo_messagesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Diplo_messagesUpdateData


class Diplo_messagesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Diplo_messagesBatchUpdateItem]


class Diplo_messagesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Diplo_messagesListResponse)
async def query_diplo_messagess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query diplo_messagess with filtering, sorting, and pagination"""
    logger.debug(f"Querying diplo_messagess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Diplo_messagesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} diplo_messagess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying diplo_messagess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Diplo_messagesListResponse)
async def query_diplo_messagess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query diplo_messagess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying diplo_messagess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Diplo_messagesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} diplo_messagess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying diplo_messagess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Diplo_messagesResponse)
async def get_diplo_messages(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single diplo_messages by ID"""
    logger.debug(f"Fetching diplo_messages with id: {id}, fields={fields}")
    
    service = Diplo_messagesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Diplo_messages with id {id} not found")
            raise HTTPException(status_code=404, detail="Diplo_messages not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching diplo_messages {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Diplo_messagesResponse, status_code=201)
async def create_diplo_messages(
    data: Diplo_messagesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new diplo_messages"""
    logger.debug(f"Creating new diplo_messages with data: {data}")
    
    service = Diplo_messagesService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create diplo_messages")
        
        logger.info(f"Diplo_messages created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating diplo_messages: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating diplo_messages: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Diplo_messagesResponse], status_code=201)
async def create_diplo_messagess_batch(
    request: Diplo_messagesBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple diplo_messagess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} diplo_messagess")
    
    service = Diplo_messagesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} diplo_messagess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Diplo_messagesResponse])
async def update_diplo_messagess_batch(
    request: Diplo_messagesBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple diplo_messagess in a single request"""
    logger.debug(f"Batch updating {len(request.items)} diplo_messagess")
    
    service = Diplo_messagesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} diplo_messagess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Diplo_messagesResponse)
async def update_diplo_messages(
    id: int,
    data: Diplo_messagesUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing diplo_messages"""
    logger.debug(f"Updating diplo_messages {id} with data: {data}")

    service = Diplo_messagesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Diplo_messages with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Diplo_messages not found")
        
        logger.info(f"Diplo_messages {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating diplo_messages {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating diplo_messages {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_diplo_messagess_batch(
    request: Diplo_messagesBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple diplo_messagess by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} diplo_messagess")
    
    service = Diplo_messagesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} diplo_messagess successfully")
        return {"message": f"Successfully deleted {deleted_count} diplo_messagess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_diplo_messages(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single diplo_messages by ID"""
    logger.debug(f"Deleting diplo_messages with id: {id}")
    
    service = Diplo_messagesService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Diplo_messages with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Diplo_messages not found")
        
        logger.info(f"Diplo_messages {id} deleted successfully")
        return {"message": "Diplo_messages deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting diplo_messages {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")