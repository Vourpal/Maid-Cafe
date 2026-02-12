# Use docker-compose for maximum compatibility on Windows
COMPOSE = docker-compose

# Start full stack
up:
	$(COMPOSE) up --build

# Stop everything
down:
	$(COMPOSE) down

# Follow logs from all services
logs:
	$(COMPOSE) logs -f

# Rebuild everything cleanly
rebuild:
	$(COMPOSE) down
	$(COMPOSE) build --no-cache
	$(COMPOSE) up

# Run backend only
backend:
	$(COMPOSE) up --build backend

# Run frontend only
frontend:
	$(COMPOSE) up --build frontend

# Dev mode: run both but don't detach
dev:
	$(COMPOSE) up

# Clean up containers, images, networks
clean:
	docker system prune -af