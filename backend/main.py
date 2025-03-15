import uvicorn
from pyngrok import ngrok

if __name__ == "__main__":
    public_url = ngrok.connect(5000)
    print(f"Public URL: {public_url}")
    uvicorn.run("app:app", host="127.0.0.1", port=5000, reload=True)
