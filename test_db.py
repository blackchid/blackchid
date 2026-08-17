from sqlalchemy import create_engine
urls = [
    "postgresql://localhost:5432/postgres",
    "postgresql://volt@localhost:5432/postgres",
    "postgresql://postgres@localhost:5432/postgres"
]
for url in urls:
    try:
        engine = create_engine(url)
        engine.connect()
        print(f"Success: {url}")
        break
    except Exception as e:
        print(f"Failed: {url}")
