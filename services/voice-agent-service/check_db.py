import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import get_settings

async def check_tables():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    
    async with engine.begin() as conn:
        # Get all tables
        result = await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
        tables = [row[0] for row in result.fetchall()]
        print("Tables in database:", tables)
        
        # Check if complaints table exists
        if 'complaints' in tables:
            result = await conn.execute(text("SELECT COUNT(*) FROM complaints"))
            count = result.scalar()
            print(f"\nComplaints count: {count}")
            
            if count > 0:
                result = await conn.execute(text("SELECT reference_number, category, district, created_at FROM complaints ORDER BY created_at DESC LIMIT 5"))
                print("\nRecent complaints:")
                for row in result.fetchall():
                    print(f"  {row[0]} | {row[1]} | {row[2]} | {row[3]}")
        else:
            print("\n❌ 'complaints' table does NOT exist!")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_tables())
