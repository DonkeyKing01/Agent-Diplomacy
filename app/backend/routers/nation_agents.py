import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.nation_agents import Nation_agentsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/nation_agents", tags=["nation_agents"])


# ---------- Pydantic Schemas ----------
class Nation_agentsData(BaseModel):
    """Entity data schema (for create/update)"""
    session_key: str
    nation_id: str
    nation_name: str
    system_prompt: str = None
    skills_md: str = None
    memory: str = None
    annual_advice: str = None
    aggression: int = None
    loyalty: int = None
    cunning: int = None


class Nation_agentsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    session_key: Optional[str] = None
    nation_id: Optional[str] = None
    nation_name: Optional[str] = None
    system_prompt: Optional[str] = None
    skills_md: Optional[str] = None
    memory: Optional[str] = None
    annual_advice: Optional[str] = None
    aggression: Optional[int] = None
    loyalty: Optional[int] = None
    cunning: Optional[int] = None


class Nation_agentsResponse(BaseModel):
    """Entity response schema"""
    id: int
    session_key: str
    nation_id: str
    nation_name: str
    system_prompt: Optional[str] = None
    skills_md: Optional[str] = None
    memory: Optional[str] = None
    annual_advice: Optional[str] = None
    aggression: Optional[int] = None
    loyalty: Optional[int] = None
    cunning: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Nation_agentsListResponse(BaseModel):
    """List response schema"""
    items: List[Nation_agentsResponse]
    total: int
    skip: int
    limit: int


class Nation_agentsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Nation_agentsData]


class Nation_agentsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Nation_agentsUpdateData


class Nation_agentsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Nation_agentsBatchUpdateItem]


class Nation_agentsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Nation_agentsListResponse)
async def query_nation_agentss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query nation_agentss with filtering, sorting, and pagination"""
    logger.debug(f"Querying nation_agentss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Nation_agentsService(db)
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
        logger.debug(f"Found {result['total']} nation_agentss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying nation_agentss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Nation_agentsListResponse)
async def query_nation_agentss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query nation_agentss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying nation_agentss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Nation_agentsService(db)
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
        logger.debug(f"Found {result['total']} nation_agentss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying nation_agentss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Nation_agentsResponse)
async def get_nation_agents(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single nation_agents by ID"""
    logger.debug(f"Fetching nation_agents with id: {id}, fields={fields}")
    
    service = Nation_agentsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Nation_agents with id {id} not found")
            raise HTTPException(status_code=404, detail="Nation_agents not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching nation_agents {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Nation_agentsResponse, status_code=201)
async def create_nation_agents(
    data: Nation_agentsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new nation_agents"""
    logger.debug(f"Creating new nation_agents with data: {data}")
    
    service = Nation_agentsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create nation_agents")
        
        logger.info(f"Nation_agents created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating nation_agents: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating nation_agents: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Nation_agentsResponse], status_code=201)
async def create_nation_agentss_batch(
    request: Nation_agentsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple nation_agentss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} nation_agentss")
    
    service = Nation_agentsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} nation_agentss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Nation_agentsResponse])
async def update_nation_agentss_batch(
    request: Nation_agentsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple nation_agentss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} nation_agentss")
    
    service = Nation_agentsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} nation_agentss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Nation_agentsResponse)
async def update_nation_agents(
    id: int,
    data: Nation_agentsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing nation_agents"""
    logger.debug(f"Updating nation_agents {id} with data: {data}")

    service = Nation_agentsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Nation_agents with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Nation_agents not found")
        
        logger.info(f"Nation_agents {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating nation_agents {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating nation_agents {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_nation_agentss_batch(
    request: Nation_agentsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple nation_agentss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} nation_agentss")
    
    service = Nation_agentsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} nation_agentss successfully")
        return {"message": f"Successfully deleted {deleted_count} nation_agentss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_nation_agents(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single nation_agents by ID"""
    logger.debug(f"Deleting nation_agents with id: {id}")
    
    service = Nation_agentsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Nation_agents with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Nation_agents not found")
        
        logger.info(f"Nation_agents {id} deleted successfully")
        return {"message": "Nation_agents deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting nation_agents {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")