# ¿Qué harías vos? — Juego de decisiones

Aplicación web estática hecha con HTML5, CSS3 y JavaScript puro.

## Cómo ejecutar
1. Descargá y descomprimí el ZIP.
2. Abrí `index.html` en Chrome, Edge o Firefox.
3. No requiere instalación, servidor, base de datos ni conexión a internet (salvo las fuentes tipográficas, que tienen alternativa local).

## Cómo modificar escenarios
Abrí `app.js` y editá el objeto `scenes`.
Cada escena tiene:
- `chapter`: número de capítulo.
- `category`, `title`, `description`: textos.
- `art`: estilo visual (`school`, `friends`, `home`, `digital`, `community`).
- `choices`: opciones con `text` y `next`. `next` debe coincidir con el ID de otra escena.

Los finales están en `endings`. Para cambiar el destino final, conectá una opción con `next: "final_valiente"`, `"final_fuerte"`, `"final_triste"` o `"final_reaccion"`.

## Temporizador
El tiempo está configurado en 8 segundos. Si llega a cero, la escena vuelve a empezar automáticamente y no se registra una decisión.
Buscá `timeLeft = 8` en `app.js` para cambiar la duración.

## Publicar gratis
Podés subir estos tres archivos a Netlify Drop o a un repositorio de GitHub y publicarlo con Netlify Pages.
