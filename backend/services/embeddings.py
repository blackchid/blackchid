from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

# Initialize the model once. It will be loaded into memory.
# all-MiniLM-L6-v2 is small (90MB) and very fast, producing 384-dimensional vectors.
MODEL_NAME = "all-MiniLM-L6-v2"

try:
    logger.info(f"Loading SentenceTransformer model: {MODEL_NAME}")
    embedding_model = SentenceTransformer(MODEL_NAME)
except Exception as e:
    logger.error(f"Failed to load SentenceTransformer model: {e}")
    embedding_model = None

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate dense vector embeddings for a list of text strings.
    Returns a list of vectors (each vector is a list of 384 floats).
    """
    if not embedding_model:
        logger.warning("Embedding model not loaded. Returning empty embeddings.")
        return [[] for _ in texts]
    
    if not texts:
        return []
        
    embeddings = embedding_model.encode(texts)
    # encode() returns a numpy array, we convert to python lists of floats for pgvector
    return [embedding.tolist() for embedding in embeddings]
