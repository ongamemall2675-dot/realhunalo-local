from backend import app

def list_routes():
    print("-" * 30)
    for route in app.routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        if path:
            print(f"ROUTE: {path} [{','.join(methods) if methods else ''}]")
    print("-" * 30)

if __name__ == "__main__":
    list_routes()
