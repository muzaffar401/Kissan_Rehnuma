"""Migrate orphan complaints to farmer_id=1."""
import asyncio
from sqlalchemy import text
from app.db.session import get_engine

async def migrate():
    engine = get_engine()
    target_farmer_id = '00000000-0000-0000-0000-000000000001'
    
    async with engine.begin() as conn:
        # Check how many orphan complaints exist
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM complaints WHERE farmer_id != :target_id"
        ), {"target_id": target_farmer_id})
        orphan_count = result.scalar()
        print(f'Found {orphan_count} orphan complaints to migrate')
        
        if orphan_count > 0:
            # Update all orphan complaints to farmer_id=1
            result = await conn.execute(text(
                "UPDATE complaints SET farmer_id = :target_id "
                "WHERE farmer_id != :target_id"
            ), {"target_id": target_farmer_id})
            print(f'Migrated {result.rowcount} complaints to farmer_id=1')
        else:
            print('No orphan complaints to migrate')
        
        # Verify
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM complaints WHERE farmer_id = :target_id"
        ), {"target_id": target_farmer_id})
        final_count = result.scalar()
        print(f'\nFarmer 1 now has {final_count} complaint(s)')

asyncio.run(migrate())
