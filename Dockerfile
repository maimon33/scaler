FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S -g 10001 scaler && adduser -S -D -u 10001 -G scaler scaler
COPY --chown=scaler:scaler --from=builder /app/dist ./dist
COPY --chown=scaler:scaler --from=builder /app/node_modules ./node_modules
COPY --chown=scaler:scaler --from=builder /app/package.json ./package.json
COPY --chown=scaler:scaler --from=builder /app/controller ./controller
USER scaler
EXPOSE 3000 3001
CMD ["npm", "run", "start", "--", "--ip", "0.0.0.0", "--port", "3000"]
