"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface DeviceStatus {
  id: string;
  type: "charger" | "bess" | "pcs" | "meter";
  alarm: boolean;
  temp: number;
}

export default function Station3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [alarmCount, setAlarmCount] = useState(0);

  useEffect(() => {
    // Fetch device status
    const fetchStatus = async () => {
      try {
        const aRes = await fetch("/api/alarms?limit=50").then((r) => r.json());
        const alarmDevices = new Set(
          (aRes || []).filter((a: any) => a.severity >= 2).map((a: any) => a.device_id)
        );
        setAlarmCount(alarmDevices.size);
        const allDevices = ["CP-01","CP-02","CP-03","CP-04","CP-05","CP-06",
                            "CP-07","CP-08","CP-09","CP-10","CP-11","CP-12",
                            "BESS-01","PCS-01","METER-01"];
        setDevices(allDevices.map((id) => ({
          id,
          type: id.startsWith("CP") ? "charger" :
                id.startsWith("BESS") ? "bess" :
                id.startsWith("PCS") ? "pcs" : "meter",
          alarm: alarmDevices.has(id),
          temp: 40 + Math.random() * 20,
        })));
      } catch (e) { console.error(e); }
    };
    fetchStatus();
    const iv = setInterval(fetchStatus, 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!mountRef.current || devices.length === 0) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.Fog(0x0a0a0f, 20, 60);

    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(12, 10, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(40, 30);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x151520, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(40, 40, 0x222244, 0x1a1a2a);
    grid.position.y = 0.01;
    scene.add(grid);

    // Device meshes
    const meshes: THREE.Mesh[] = [];
    devices.forEach((dev, i) => {
      let geo: THREE.BufferGeometry;
      let color = dev.alarm ? 0xff3333 : 0x2288cc;

      if (dev.type === "charger") {
        geo = new THREE.BoxGeometry(0.8, 1.8, 0.6);
      } else if (dev.type === "bess") {
        geo = new THREE.BoxGeometry(4, 2.5, 2);
      } else if (dev.type === "pcs") {
        geo = new THREE.BoxGeometry(1.5, 1.5, 1);
      } else {
        geo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: dev.alarm ? 0xff0000 : 0x000000,
        emissiveIntensity: dev.alarm ? 0.5 : 0,
      });

      const mesh = new THREE.Mesh(geo, mat);

      // Position
      if (dev.type === "charger") {
        const row = Math.floor(i / 6);
        const col = i % 6;
        mesh.position.set(-6 + col * 2.2, 0.9, -2 + row * 3);
      } else if (dev.type === "bess") {
        mesh.position.set(8, 1.25, 0);
      } else if (dev.type === "pcs") {
        mesh.position.set(5, 0.75, 0);
      } else {
        mesh.position.set(-8, 1, 0);
      }

      mesh.castShadow = true;
      scene.add(mesh);
      meshes.push(mesh);

      // Label sprite
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = dev.alarm ? "#ff4444" : "#4488ff";
      ctx.font = "bold 20px monospace";
      ctx.fillText(dev.id, 10, 22);
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(mesh.position);
      sprite.position.y += dev.type === "bess" ? 2 : 1.5;
      sprite.scale.set(2, 0.5, 1);
      scene.add(sprite);
    });

    // Animation loop
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = Date.now() * 0.001;

      // Rotate camera slowly
      camera.position.x = Math.cos(t * 0.1) * 15;
      camera.position.z = Math.sin(t * 0.1) * 15;
      camera.lookAt(0, 0, 0);

      // Blink alarm devices
      meshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.emissive.getHex() === 0xff0000) {
          mat.emissiveIntensity = 0.3 + Math.sin(t * 5) * 0.3;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [devices]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="p-4 flex justify-between items-center bg-gray-900">
        <h1 className="text-xl font-bold text-cyan-400">Saker Energy · 3D场站数字孪生</h1>
        <div className="flex gap-4 text-sm">
          <span>在线设备: <b className="text-green-400">15/15</b></span>
          <span>告警设备: <b className="text-red-400">{alarmCount}</b></span>
        </div>
      </header>
      <div ref={mountRef} className="w-full" style={{ height: "calc(100vh - 60px)" }} />
    </div>
  );
}
