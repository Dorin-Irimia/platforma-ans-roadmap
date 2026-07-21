FROM node:20-alpine
WORKDIR /app
# Alpine nu vine cu OpenSSL — fără el, motorul Prisma (schema-engine) crapă la
# fiecare pornire cu "Could not parse schema engine response" (eroare cunoscută
# pe imagini node:*-alpine). libc6-compat e necesar pentru binarul motorului Prisma pe musl.
RUN apk add --no-cache openssl libc6-compat espeak-ng
COPY package.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
EXPOSE 4000
# La fiecare pornire: sincronizează schema Postgres (fără migrații manuale) apoi pornește serverul.
CMD ["npm", "run", "docker:start"]
