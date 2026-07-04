import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.war_reports import War_reportsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/war_reports", tags=["war_reports"])


# ---------- Pydantic Schemas ----------
class War_reportsData(BaseModel):
    """Entity data schema (for create/update)"""
    session_key: str
    year: int
    season: str
    phase_index: int = None
    headline: str = None
    body: str


class War_reportsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    session_key: Optional[str] = None
    year: Optional[int] = None
    season: Optional[str] = None
    phase_index: Optional[int] = None
    headline: Optional[str] = None
    body: Optional[str] = None


class War_reportsResponse(BaseModel):
    """Entity response schema"""
    id: int
    session_key: str
    year: int
    season: str
    phase_index: Optional[int] = None
    headline: Optional[str] = None
    body: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class War_reportsListResponse(BaseModel):
    """List response schema"""
    items: List[War_reportsResponse]
    total: int
    skip: int
    limit: int


class War_reportsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[War_reportsData]


class War_reportsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: War_reportsUpdateData


class War_reportsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[War_reportsBatchUpdateItem]


class War_reportsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=War_reportsListResponse)
async def query_war_reportss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query war_reportss with filtering, sorting, and pagination"""
    logger.debug(f"Querying war_reportss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = War_reportsService(db)
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
        logger.debug(f"Found {result['total']} war_reportss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying war_reportss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=War_reportsListResponse)
async def query_war_reportss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query war_reportss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying war_reportss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = War_reportsService(db)
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
        logger.debug(f"Found {result['total']} war_reportss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying war_reportss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=War_reportsResponse)
async def get_war_reports(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single war_reports by ID"""
    logger.debug(f"Fetching war_reports with id: {id}, fields={fields}")
    
    service = War_reportsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"War_reports with id {id} not found")
            raise HTTPException(status_code=404, detail="War_reports not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching war_reports {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=War_reportsResponse, status_code=201)
async def create_war_reports(
    data: War_reportsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new war_reports"""
    logger.debug(f"Creating new war_reports with data: {data}")
    
    service = War_reportsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create war_reports")
        
        logger.info(f"War_reports created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating war_reports: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating war_reports: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[War_reportsResponse], status_code=201)
async def create_war_reportss_batch(
    request: War_reportsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple war_reportss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} war_reportss")
    
    service = War_reportsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} war_reportss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[War_reportsResponse])
async def update_war_reportss_batch(
    request: War_reportsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple war_reportss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} war_reportss")
    
    service = War_reportsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} war_reportss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=War_reportsResponse)
async def update_war_reports(
    id: int,
    data: War_reportsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing war_reports"""
    logger.debug(f"Updating war_reports {id} with data: {data}")

    service = War_reportsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"War_reports with id {id} not found for update")
            raise HTTPException(status_code=404, detail="War_reports not found")
        
        logger.info(f"War_reports {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating war_reports {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating war_reports {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_war_reportss_batch(
    request: War_reportsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple war_reportss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} war_reportss")
    
    service = War_reportsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} war_reportss successfully")
        return {"message": f"Successfully deleted {deleted_count} war_reportss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_war_reports(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single war_reports by ID"""
    logger.debug(f"Deleting war_reports with id: {id}")
    
    service = War_reportsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"War_reports with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="War_reports not found")
        
        logger.info(f"War_reports {id} deleted successfully")
        return {"message": "War_reports deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting war_reports {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")