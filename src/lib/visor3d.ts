import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Visor 3D de los diseños de LEBRON (el archivo .glb que manda el plugin junto
 * con el presupuesto). Se gira con el dedo o el mouse, se acerca con dos dedos o
 * la rueda, y un toque en una puerta o un cajón lo abre o lo cierra.
 *
 * Lo que se abre viene marcado en el archivo: un nodo con extras.lebron_mueve
 * agrupa la puerta (o el frente del cajón con su caja, o la hoja corrediza con
 * sus manijones) y dice cómo se mueve, en las medidas de SketchUp del mueble:
 *   { tipo: "giro", punto: [x,y,z], eje: [x,y,z], angulo: grados }
 *   { tipo: "traslacion", vector: [x,y,z] }
 * Cerrado es la posición del archivo; abierto, ese movimiento aplicado entero.
 */

type Movimiento =
  | { tipo: "giro"; punto: number[]; eje: number[]; angulo: number }
  | { tipo: "traslacion"; vector: number[] };

interface Abrible {
  objeto: THREE.Object3D;
  mov: Movimiento;
  /** 0 = cerrado, 1 = abierto. */
  t: number;
  objetivo: number;
}

export interface Visor {
  /** Abre (true) o cierra (false) todas las puertas y cajones. */
  abrirTodo(abrir: boolean): void;
  /** Vuelve a la vista del principio. */
  centrar(): void;
  cantidadAbribles: number;
  liberar(): void;
}

const DURACION_S = 0.7;
const COLOR_FONDO = 0xf4f2ee;

function suavizar(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function matrizDe(a: Abrible, destino: THREE.Matrix4) {
  const t = suavizar(a.t);
  if (a.mov.tipo === "giro") {
    const [px, py, pz] = a.mov.punto;
    const eje = new THREE.Vector3(...(a.mov.eje as [number, number, number])).normalize();
    destino
      .makeTranslation(px, py, pz)
      .multiply(new THREE.Matrix4().makeRotationAxis(eje, THREE.MathUtils.degToRad(a.mov.angulo) * t))
      .multiply(new THREE.Matrix4().makeTranslation(-px, -py, -pz));
  } else {
    const [vx, vy, vz] = a.mov.vector;
    destino.makeTranslation(vx * t, vy * t, vz * t);
  }
}

export async function crearVisor(
  contenedor: HTMLElement,
  url: string,
  alAvanzar?: (fraccion: number) => void
): Promise<Visor> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo traer el diseño (${respuesta.status}).`);
  const total = Number(respuesta.headers.get("content-length")) || 0;
  let datos: ArrayBuffer;
  if (respuesta.body && total && alAvanzar) {
    const lector = respuesta.body.getReader();
    const partes: Uint8Array[] = [];
    let recibido = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(value);
      recibido += value.length;
      alAvanzar(Math.min(recibido / total, 1));
    }
    const todo = new Uint8Array(recibido);
    let desde = 0;
    for (const p of partes) {
      todo.set(p, desde);
      desde += p.length;
    }
    datos = todo.buffer;
  } else {
    datos = await respuesta.arrayBuffer();
  }
  const gltf = await new GLTFLoader().parseAsync(datos, "");

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLOR_FONDO);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environment = ambiente;
  escena.environmentIntensity = 0.9;

  const modelo = gltf.scene;
  escena.add(modelo);
  modelo.updateMatrixWorld(true);

  // Los cantos de cada pieza, como en SketchUp: sin ellos, dos placas blancas
  // pegadas se ven como una sola.
  const materialLineas = new THREE.LineBasicMaterial({ color: 0x3a3530, transparent: true, opacity: 0.35 });
  const mallas: THREE.Mesh[] = [];
  modelo.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) mallas.push(o as THREE.Mesh);
  });
  for (const m of mallas) {
    m.castShadow = true;
    m.receiveShadow = true;
    const lineas = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), materialLineas);
    lineas.raycast = () => {};
    m.add(lineas);
  }

  const abribles: Abrible[] = [];
  modelo.traverse((o) => {
    const mov = o.userData?.lebron_mueve as Movimiento | undefined;
    if (!mov) return;
    o.matrixAutoUpdate = false;
    abribles.push({ objeto: o, mov, t: 0, objetivo: 0 });
  });

  // El tamaño y el centro de todo, para el piso, la luz y la cámara.
  const caja = new THREE.Box3().setFromObject(modelo);
  const centro = caja.getCenter(new THREE.Vector3());
  const tamaño = caja.getSize(new THREE.Vector3());
  const radio = Math.max(tamaño.length() / 2, 0.3);

  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(radio * 12, radio * 12),
    new THREE.ShadowMaterial({ opacity: 0.18 })
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(centro.x, caja.min.y - 0.001, centro.z);
  piso.receiveShadow = true;
  piso.raycast = () => {};
  escena.add(piso);

  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(centro.x + radio * 1.2, caja.max.y + radio * 2.5, centro.z + radio * 2);
  sol.target.position.copy(centro);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.02;
  const s = sol.shadow.camera as THREE.OrthographicCamera;
  s.left = -radio * 1.6;
  s.right = radio * 1.6;
  s.top = radio * 1.6;
  s.bottom = -radio * 1.6;
  s.near = 0.1;
  s.far = radio * 8;
  escena.add(sol, sol.target);
  escena.add(new THREE.HemisphereLight(0xffffff, 0xd8d0c4, 0.5));

  const camara = new THREE.PerspectiveCamera(40, 1, 0.01, radio * 40);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.maxPolarAngle = Math.PI / 2 - 0.02; // que no se meta abajo del piso
  controles.minDistance = radio * 0.15;
  controles.maxDistance = radio * 6;

  // De frente, un poco desde arriba y de costado, con todo a la vista. Hacia
  // dónde miran los muebles lo dice el archivo (extras.lebron_frente, en
  // SketchUp: x, y), porque pueden estar girados en el modelo; sin ese dato,
  // el frente de SketchUp (-Y, que en el archivo es +Z).
  const f = modelo.userData?.lebron_frente as number[] | undefined;
  const frente = f ? new THREE.Vector3(f[0], 0, -f[1]) : new THREE.Vector3(0, 0, 1);
  if (frente.lengthSq() < 1e-9) frente.set(0, 0, 1);
  frente.normalize();
  const costado = new THREE.Vector3(0, 1, 0).cross(frente).normalize();
  const direccion = frente.clone().addScaledVector(costado, 0.35).add(new THREE.Vector3(0, 0.32, 0)).normalize();

  // Que entre todo a lo alto y a lo ancho (en un celular parado, manda el ancho).
  function centrar() {
    const mitadVertical = THREE.MathUtils.degToRad(camara.fov / 2);
    const mitadHorizontal = Math.atan(Math.tan(mitadVertical) * camara.aspect);
    const distancia = (radio / Math.sin(Math.min(mitadVertical, mitadHorizontal))) * 1.05;
    camara.position.copy(centro).addScaledVector(direccion, distancia);
    controles.target.copy(centro);
    controles.update();
  }

  function ajustarTamaño() {
    const ancho = contenedor.clientWidth || 1;
    const alto = contenedor.clientHeight || 1;
    renderer.setSize(ancho, alto, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  }
  ajustarTamaño();
  centrar();
  const observador = new ResizeObserver(ajustarTamaño);
  observador.observe(contenedor);

  // Un toque (sin arrastrar) sobre algo que se abre lo abre o lo cierra.
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let inicio: { x: number; y: number } | null = null;

  function abribleEn(e: PointerEvent): Abrible | null {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const toque = rayo.intersectObject(modelo, true)[0];
    for (let o: THREE.Object3D | null = toque?.object ?? null; o; o = o.parent) {
      const a = abribles.find((x) => x.objeto === o);
      if (a) return a;
    }
    return null;
  }

  const alApretar = (e: PointerEvent) => {
    inicio = { x: e.clientX, y: e.clientY };
  };
  const alSoltar = (e: PointerEvent) => {
    if (!inicio) return;
    const movido = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    inicio = null;
    if (movido > 6) return;
    const a = abribleEn(e);
    if (a) a.objetivo = a.objetivo > 0.5 ? 0 : 1;
  };
  const alMover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || inicio) return;
    renderer.domElement.style.cursor = abribleEn(e) ? "pointer" : "grab";
  };
  renderer.domElement.addEventListener("pointerdown", alApretar);
  renderer.domElement.addEventListener("pointerup", alSoltar);
  renderer.domElement.addEventListener("pointermove", alMover);

  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.1);
    for (const a of abribles) {
      if (a.t === a.objetivo) continue;
      const paso = dt / DURACION_S;
      a.t = a.objetivo > a.t ? Math.min(a.t + paso, a.objetivo) : Math.max(a.t - paso, a.objetivo);
      matrizDe(a, a.objeto.matrix);
      a.objeto.matrixWorldNeedsUpdate = true;
    }
    controles.update();
    renderer.render(escena, camara);
  });

  return {
    cantidadAbribles: abribles.length,
    abrirTodo(abrir: boolean) {
      for (const a of abribles) a.objetivo = abrir ? 1 : 0;
    },
    centrar,
    liberar() {
      renderer.setAnimationLoop(null);
      observador.disconnect();
      renderer.domElement.removeEventListener("pointerdown", alApretar);
      renderer.domElement.removeEventListener("pointerup", alSoltar);
      renderer.domElement.removeEventListener("pointermove", alMover);
      controles.dispose();
      escena.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const materiales = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of materiales) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        }
      });
      ambiente.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
