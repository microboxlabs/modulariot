# Use Bun base image
FROM oven/bun:alpine

# Set the working directory inside the container
WORKDIR /app

# Copy root package.json and lockfile for workspace setup
COPY package.json bun.lockb* ./

# Copy the BFF application code
COPY . .

WORKDIR /app/apps/bff

CMD ["bun", "run", "start"]
