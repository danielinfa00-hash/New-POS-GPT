# Maryo's POS

Base de la Fase 1 del POS, construida con React, Vite, Firebase y PWA.

## Inicio local

1. Copia `.env.example` a `.env` y completa las variables de un proyecto Firebase.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.

## Firebase

Habilita Authentication (Email/Password), Cloud Firestore y Storage en Firebase. Despliega las reglas con `firebase deploy --only firestore:rules,storage`.

### Primer administrador

1. Crea su cuenta con correo y contraseña en **Firebase Console → Authentication → Users**.
2. En **Firestore Database**, crea manualmente `users/{UID_DEL_USUARIO}` con los campos `name` (texto), `email` (texto), `role` (texto: `ADMIN`) y `active` (booleano: `true`).

La creación manual inicial es deliberada: las reglas no permiten que una cuenta se asigne a sí misma el rol ADMIN. Los demás roles válidos son `CAJERO` y `COCINA`.

## Catálogo

El administrador puede crear, editar, activar, desactivar y eliminar categorías y productos. Las categorías con productos no pueden eliminarse. Los productos con ventas históricas tampoco se eliminan: deben desactivarse para conservar la integridad de las ventas. Las imágenes aceptan JPEG, PNG y WebP de hasta 5 MB, pero Firebase Storage exige actualmente el plan Blaze; por eso son opcionales y pueden activarse después.

## POS

El POS admite **efectivo**, **transferencia** y pago **mixto**. Al marcar una venta como domicilio, su costo se integra al total y queda almacenado en la venta y el pedido. Cada cobro usa una transacción de Firestore para asignar un número de pedido consecutivo sin duplicados y conservar el precio histórico de cada artículo.

## Vercel

Importa el repositorio, define las mismas variables `VITE_FIREBASE_*` en Vercel y despliega. `vercel.json` permite recargar las rutas de la SPA.

## Offline

Firestore habilita persistencia IndexedDB cuando Firebase está configurado. La sincronización real de ventas y el manejo de conflictos se implementarán en las fases de POS.
