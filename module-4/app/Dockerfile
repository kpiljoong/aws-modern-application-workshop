FROM ubuntu:latest

RUN echo Updating existing packages, installing and upgrading python and pip.
RUN apt-get update -y && \
    apt-get install -y python3-pip python3-dev build-essential python3-venv

RUN python3 -m venv /env

RUN /env/bin/pip install --upgrade pip

COPY ./service /MythicalMysfitsService

WORKDIR /MythicalMysfitsService

RUN /env/bin/pip install -r requirements.txt

RUN echo Starting python and starting the Flask service...
ENTRYPOINT ["/env/bin/python3"]
CMD ["mythicalMysfitsService.py"]
