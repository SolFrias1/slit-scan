# Tiempo e imagen: Slit Scan

Herramienta web para explorar el tiempo de un video como espacio. Carga un video, sepáralo en frames y apílalos en 3D. Luego ajusta cómo se distribuyen, procésalos y anímalos con keyframes.

Todo corre en el navegador: el video nunca sale de tu equipo.

## Qué puedes hacer

- **Extraer frames** de cualquier tramo del video, eligiendo cuántos por segundo y a qué ancho.
- **Apilarlos en Z** controlando la distancia, el rango de frames y el orden.
- **Transformar la pila** desde un frame de referencia hacia los extremos: escala constante, lineal u onda, giro acumulado en grados enteros, opacidad y edge fade con borde irregular.
- **Procesar la imagen:** recorte por brillo o por color (con cuentagotas), mostrar solo lo que cambia entre frames y teñido por tiempo con dos colores.
- **Animar con keyframes:** cámara, frame seleccionado, escala, giro, opacidad y procesamiento, con atajos de órbita de cámara y recorrido de frames.
- **Ver** en perspectiva libre, frontal o isométrica, con fondo negro, blanco o tomado de un frame.
- **Exportar:** frame en PNG, captura de la vista 3D, video frontal, video de la vista 3D y video de la animación. Las exportaciones salen siempre a resolución completa.


## Estructura

```
index.html       Estructura de la interfaz
css/styles.css   Estilos (tema claro y oscuro según el sistema)
js/app.js        Lógica: extracción, escena 3D, procesamiento, animación y exportación
```

## Dependencias

Se cargan desde CDN, sin instalación:

- [three.js r128](https://threejs.org/) para la escena 3D.
- [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono) desde Google Fonts.

## Créditos

Desarrollado por **Felipe Roa R.** ([@fefeliperoa](https://www.instagram.com/fefeliperoa/))
DPPI / Escuela de Diseño UDP
2026

Inspirado en el trabajo de [@p_h_r_o_](https://www.instagram.com/p_h_r_o_/).

## Ejercicio de experimentación visual realizado a partir de la herramienta Slit Scan.

A través de la exploración de las posibilidades de procesamiento y transformación temporal de una secuencia de video, se desarrolló una pieza visual utilizando la herramienta existente, pero jugando con el sentimentalismo y la manera de abstracción de imagen, para que se evoque un sentimiento de añoranza o inocencia de recuerdo; aún cuando la imagen se encuentra contrastada en negro, el amor a un can juega con las luces a la vista, en ida y vuelta con rapidez y borrosidad de memoria.

Participación: exploración y producción de video mediante la herramienta. No se realizaron modificaciones al código fuente ni al funcionamiento original del repositorio.
