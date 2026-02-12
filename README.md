# **Maid Café — Full‑Stack Application**

A full‑stack practice application designed to sharpen backend‑first engineering skills, containerized development workflows, and clean project structure. The stack includes:

- **Python / Flask** (backend)
- **Next.js** (frontend)
- **Docker Compose** for multi‑service orchestration
- **Makefile** for a smooth, reproducible developer experience

This setup mirrors a real production environment with isolated services, consistent builds, and zero dependency conflicts on the host machine.

---

## **📦 Project Structure**

```
.
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── ...
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml
├── Makefile
└── README.md
```

Each service is fully containerized and can be run independently or together.

---

## **🚀 Getting Started**

### **Prerequisites**
You only need:

- Docker Desktop  
- Git Bash (recommended on Windows)  
- Make (included with Git Bash)

No local Python or Node installation required — everything runs inside containers.

---

## **🐳 Running the Application**

The Makefile abstracts all Docker commands into simple, memorable shortcuts.

### **Start the full stack**

```bash
make up
```

Builds and starts both backend and frontend containers.

---

### **Stop everything**

```bash
make down
```

---

### **View logs**

```bash
make logs
```

Streams logs from all running services.

---

### **Rebuild everything from scratch**

```bash
make rebuild
```

Useful when dependencies change or containers get out of sync.

---

## **🧩 Running Individual Services**

### **Backend only**

```bash
make backend
```

### **Frontend only**

```bash
make frontend
```

### **Dev mode (both services, foreground)**

```bash
make dev
```

Runs the stack without detaching — ideal for debugging.

---

## **🧹 Cleanup Commands**

### **Remove unused containers, images, and networks**

```bash
make clean
```

Resets Docker’s environment if things get messy.

---

## **🛠 Makefile Reference**

```makefile
COMPOSE = docker-compose

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

rebuild:
	$(COMPOSE) down
	$(COMPOSE) build --no-cache
	$(COMPOSE) up

backend:
	$(COMPOSE) up --build backend

frontend:
	$(COMPOSE) up --build frontend

dev:
	$(COMPOSE) up

clean:
	docker system prune -af
```

---

## **📚 Notes**

- This project intentionally uses **docker-compose** (the classic binary) because it behaves more consistently on Windows + Git Bash.
- The Makefile provides a clean, repeatable workflow for development.
- The structure is designed to scale — adding databases, caching layers, or additional services is straightforward.

---

## **🎯 Future Improvements**

- Add a database service (PostgreSQL or SQLite)
- Add migrations (Alembic / Prisma)
- Add authentication (JWT or session‑based)
- Add CI/CD pipeline
- Add production‑grade multi‑stage Docker builds

---

If you want, I can also generate:

- a CONTRIBUTING.md  
- environment variable templates  
- API documentation  
- GitHub badges  
- or a polished project description for your repo’s landing page  

Just tell me what direction you want to take this project next.
