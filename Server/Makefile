run:
	DOCKER_BUILDKIT=1 docker build -t maid-cafe-backend .
	docker run -p 5000:5000 \
		-e FLASK_APP=app.py \
		-e FLASK_ENV=development \
		-e FLASK_DEBUG=1 \
		-v "$(shell pwd):/app" \
		maid-cafe-backend flask run --host=0.0.0.0 --port=5000
