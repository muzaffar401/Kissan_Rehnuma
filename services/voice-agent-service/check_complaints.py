"""Check complaints in database."""
import asyncio
from sqlalchemy import text
from app.db.session import get_engine

async def check():
    engine = get_engine()
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT COUNT(*) FROM complaints'))
        count = result.scalar()
        print(f'Total complaints: {count}')
        
        result2 = await conn.execute(text(
            'SELECT farmer_id, category, status, description, created_at '
            'FROM complaints ORDER BY created_at DESC LIMIT 10'
        ))
        print('\nRecent complaints:')
        for row in result2:
            print(f'  farmer_id={row[0]}, category={row[1]}, status={row[2]}, '
                  f'desc={row[3][:40]}..., created={row[4]}')

asyncio.run(check())
