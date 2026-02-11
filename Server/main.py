from flask import Flask, request

app = Flask(__name__)

def success_response(data, status=200):
    return {
        "success": True,
        "data": data,
        "error": None
    }, status

class APIError(Exception):
    def __init__(self, code, message, status = 400):
        self.code = code
        self.message = message
        self.status = status


@app.errorhandler(APIError)
def handle_api_error(err):
    return {
        "success": False,
        "data": None,
        "error": {
            "code": err.code,
            "message": err.message
        }
    }, err.status

@app.errorhandler(Exception)
def handle_unexpected_error(err):
    return {
        "success": False,
        "data": None,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "Something went wrong"
        }
    }, 500

@app.route("/")
def home():
    return {"success": True}

@app.route("/users")
def users():
    pass





if __name__ == "__main__":
    app.run(debug=True)