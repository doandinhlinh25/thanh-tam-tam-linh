# Build the official community sources at fixed commits.
# Public prebuilt minio/minio and minio/mc images are not required.
FROM golang:1.25-bookworm AS server-build
WORKDIR /src
RUN git init . && git remote add origin https://github.com/minio/minio.git \
    && git fetch --depth=1 origin 7aac2a2c5b7c882e68c1ce017d8256be2feea27f \
    && git checkout --detach FETCH_HEAD
RUN go build -trimpath -ldflags="-s -w" -o /out/minio .

FROM golang:1.25-bookworm AS client-build
WORKDIR /src
RUN git init . && git remote add origin https://github.com/minio/mc.git \
    && git fetch --depth=1 origin 77f82e18b5401a65958f1619df6ebb994634bd88 \
    && git checkout --detach FETCH_HEAD
RUN go build -trimpath -ldflags="-s -w" -o /out/mc .

FROM debian:bookworm-slim AS base
RUN mkdir /data /licenses && chown 10001:10001 /data
ENV HOME=/tmp
WORKDIR /data

FROM base AS minio
COPY --from=server-build /out/minio /usr/local/bin/minio
COPY --from=server-build /src/LICENSE /licenses/minio.LICENSE
USER 10001:10001
EXPOSE 9000 9001
ENTRYPOINT ["minio"]

FROM base AS mc
COPY --from=client-build /out/mc /usr/local/bin/mc
COPY --from=client-build /src/LICENSE /licenses/mc.LICENSE
ENTRYPOINT ["mc"]
