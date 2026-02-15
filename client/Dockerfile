FROM node:20

# Upgrade npm (optional)
RUN npm install -g npm@latest

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]