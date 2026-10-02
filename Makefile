.PHONY: help backend frontend dev test build clean

help:
	@echo "Available commands:"
	@echo "  make backend   - Run the Go backend server (port 8080)"
	@echo "  make frontend  - Run the Vite React frontend (port 3000)"
	@echo "  make dev       - Run both backend and frontend concurrently"
	@echo "  make test      - Run backend Go tests"
	@echo "  make build     - Build frontend bundle and backend executable"
	@echo "  make clean     - Clean build artifacts and temporary databases"

backend:
	cd backend && go run .

frontend:
	cd frontend && npm run dev

dev:
	@make -j2 backend frontend

test:
	cd backend && go test -v ./...

build:
	cd frontend && npm run build
	cd backend && go build -o server .

clean:
	-rm -f backend/test_*.db backend/server backend/server.exe
