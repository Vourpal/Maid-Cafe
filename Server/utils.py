def success_response(data, status=200):
    return {"success": True, "data": data, "error": None}, status


class APIError(Exception):
    def __init__(self, code, message, status=400):
        self.code = code
        self.message = message
        self.status = status
