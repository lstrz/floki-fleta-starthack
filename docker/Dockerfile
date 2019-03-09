FROM golang

WORKDIR /app
ENV GOPATH /app
RUN go get -u github.com/fletaio/sandbox
RUN go get -t github.com/fletaio/sandbox
WORKDIR /app/src/github.com/fletaio/sandbox
RUN go build

EXPOSE 8080

ENTRYPOINT ["./sandbox"]
