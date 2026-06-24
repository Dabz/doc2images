FROM pandoc/typst:3-ubuntu

ENV PORT=8080
EXPOSE 8080
ENV NODE_VERSION=26

# Packages
RUN apt update -y
RUN apt install -y curl
RUN apt install -y imagemagick
RUN apt install -y weasyprint
RUN apt install -y \
        fontconfig \
        libfreetype6 \
        fonts-freefont-ttf
RUN apt install -y ttf-mscorefonts-installer
RUN apt install -y libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    fontconfig \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
RUN fc-cache -f

# NVM 
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install node ${NODE_VERSION} \
    && ln -s "$NVM_DIR/versions/node/$(nvm version node)" "$NVM_DIR/versions/node/current"

RUN ln -s "$NVM_DIR/versions/node/$(nvm version node)" "$NVM_DIR/versions/node/current"
ENV PATH=$NVM_DIR/versions/node/current/bin/:$PATH
RUN node --version
RUN npm --version

# Application
COPY ./main.ts .
COPY ./package.json .

RUN npm install
ENTRYPOINT ["npm", "run", "run"]
