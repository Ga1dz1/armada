ARG FEX_PKG=ghcr.io/virtudude/armada-packages/fex@sha256:08bb88b399dcd8e7d65fb16aaa55dd7583a2c554a4a43a405eabc49c6487b576
ARG MESA_PKG=ghcr.io/virtudude/armada-packages/mesa@sha256:29eaf989c02e67b8112c66bb7159deae421c237f4f58537e6c7fe836787b9a64
ARG MANGOHUD_PKG=ghcr.io/virtudude/armada-packages/mangohud@sha256:0e0b9b88c76b6cf051244a961b51006921a6e2d853cd101538d4fa803133065a
ARG GAMESCOPE_PKG=ghcr.io/virtudude/armada-packages/gamescope@sha256:770a09d560ed7c388ae5008ebdebd9eb724c1ac83b9ea51272a7b32756ea8132
ARG KERNEL_PKG=ghcr.io/virtudude/armada-packages/kernel@sha256:296433789217cf9ccf4a7b935f42a9503b5ec0d3049a9c9b71a3d9568c4ecb4f
ARG INPUTPLUMBER_PKG=ghcr.io/virtudude/armada-packages/inputplumber@sha256:2b7cc9216c5ee58723f47dca1385551e3f18f49b585f05e67cf96b3119c10e86
ARG EXTEST_PKG=ghcr.io/virtudude/armada-packages/extest@sha256:6ebc8e19fefee8bb350af8021d19977ef465eabc32b7a9eed96622a18b3dba8c

FROM ${FEX_PKG} AS fex
FROM ${MESA_PKG} AS mesa
FROM ${MANGOHUD_PKG} AS mangohud
FROM ${GAMESCOPE_PKG} AS gamescope
FROM ${KERNEL_PKG} AS kernel
FROM ${INPUTPLUMBER_PKG} AS inputplumber
FROM ${EXTEST_PKG} AS extest

FROM scratch AS ctx
COPY build_files /build_files/
COPY system_files /system_files/

FROM quay.io/fedora/fedora-bootc:44

RUN --mount=type=bind,from=ctx,source=/,target=/ctx \
    --mount=type=bind,from=fex,source=/rpms,target=/packages/fex \
    --mount=type=bind,from=mesa,source=/rpms,target=/packages/mesa \
    --mount=type=bind,from=mangohud,source=/rpms,target=/packages/mangohud \
    --mount=type=bind,from=gamescope,source=/rpms,target=/packages/gamescope \
    --mount=type=bind,from=kernel,source=/kernel,target=/packages/kernel \
    --mount=type=bind,from=inputplumber,source=/rpms,target=/packages/inputplumber \
    --mount=type=bind,from=extest,source=/,target=/packages/extest \
    --mount=type=cache,dst=/var/cache \
    --mount=type=cache,dst=/var/log \
    --mount=type=tmpfs,dst=/tmp \
    /ctx/build_files/build.sh

RUN bootc container lint
