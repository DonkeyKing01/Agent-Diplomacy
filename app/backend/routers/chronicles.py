import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.chronicles import ChroniclesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/chronicles", tags=["chronicles"])


# ---------- Pydantic Schemas ----------
class ChroniclesData(BaseModel):
    """Entity data schema (for create/update)"""
    session_key: str
    year: int
    summary: str
    sc_snapshot_json: str = None


class ChroniclesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    session_key: Optional[str] = None
    year: Optional[int] = None
    summary: Optional[str] = None
    sc_snapshot_json: Optional[str] = None


class ChroniclesResponse(BaseModel):
    """Entity response schema"""
    id: int
    session_key: str
    year: int
    summary: str
    sc_snapshot_json: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChroniclesListResponse(BaseModel):
    """List response schema"""
    items: List[ChroniclesResponse]
    total: int
    skip: int
    limit: int


class ChroniclesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[ChroniclesData]


class ChroniclesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: ChroniclesUpdateData


class ChroniclesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[ChroniclesBatchUpdateItem]


class ChroniclesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=ChroniclesListResponse)
async def query_chronicless(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query chronicless with filtering, sorting, and pagination"""
    logger.debug(f"Querying chronicless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = ChroniclesService(db)
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
        logger.debug(f"Found {result['total']} chronicless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying chronicless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=ChroniclesListResponse)
async def query_chronicless_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query chronicless with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying chronicless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = ChroniclesService(db)
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
        logger.debug(f"Found {result['total']} chronicless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying chronicless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=ChroniclesResponse)
async def get_chronicles(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single chronicles by ID"""
    logger.debug(f"Fetching chronicles with id: {id}, fields={fields}")
    
    service = ChroniclesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Chronicles with id {id} not found")
            raise HTTPException(status_code=404, detail="Chronicles not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chronicles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=ChroniclesResponse, status_code=201)
async def create_chronicles(
    data: ChroniclesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new chronicles"""
    logger.debug(f"Creating new chronicles with data: {data}")
    
    service = ChroniclesService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create chronicles")
        
        logger.info(f"Chronicles created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating chronicles: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating chronicles: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[ChroniclesResponse], status_code=201)
async def create_chronicless_batch(
    request: ChroniclesBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple chronicless in a single request"""
    logger.debug(f"Batch creating {len(request.items)} chronicless")
    
    service = ChroniclesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} chronicless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[ChroniclesResponse])
async def update_chronicless_batch(
    request: ChroniclesBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple chronicless in a single request"""
    logger.debug(f"Batch updating {len(request.items)} chronicless")
    
    service = ChroniclesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} chronicless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=ChroniclesResponse)
async def update_chronicles(
    id: int,
    data: ChroniclesUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing chronicles"""
    logger.debug(f"Updating chronicles {id} with data: {data}")

    service = ChroniclesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Chronicles with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Chronicles not found")
        
        logger.info(f"Chronicles {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating chronicles {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating chronicles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_chronicless_batch(
    request: ChroniclesBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple chronicless by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} chronicless")
    
    service = ChroniclesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} chronicless successfully")
        return {"message": f"Successfully deleted {deleted_count} chronicless", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_chronicles(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single chronicles by ID"""
    logger.debug(f"Deleting chronicles with id: {id}")
    
    service = ChroniclesService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Chronicles with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Chronicles not found")
        
        logger.info(f"Chronicles {id} deleted successfully")
        return {"message": "Chronicles deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chronicles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")