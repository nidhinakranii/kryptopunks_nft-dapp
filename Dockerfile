# Use node:18-alpine as the base image
FROM node:18-alpine

# Set the working directory for the project
WORKDIR /app

# Copy the smart contracts and frontend directories to the container
COPY smart_contracts /app/smart_contracts
COPY front-end /app/front-end

# Install backend dependencies
RUN cd smart_contracts && yarn install

# Install frontend dependencies
RUN cd front-end && yarn install

# Build the frontend
# RUN cd front-end && yarn build

# Expose the frontend port (default React port is 3000)
EXPOSE 3000

# Command to run the backend deploy script and start the frontend
CMD sh -c "cd smart_contracts && yarn deploy --network ganache && cd ../front-end && yarn start"
