FROM ubuntu:20.04


RUN apt-get update && apt-get install -y python3 python3-pip
WORKDIR /app


COPY requirements.txt ./
RUN pip3 install -r requirements.txt


RUN apt-get install -y build-essential cmake
WORKDIR /app/cpp
COPY CMakeLists.txt ./
RUN cmake . && make


RUN npm install -g typescript
WORKDIR /app/ts
COPY tsconfig.json ./
COPY src/ ./
RUN tsc


EXPOSE 3000


CMD ["npm", "start"]
