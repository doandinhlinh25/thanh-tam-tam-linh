ARG KONG_BASE_IMAGE

FROM ${KONG_BASE_IMAGE}

USER root

COPY plugins /usr/local/share/lua/5.1/kong/plugins

USER kong
