import YAML from "yaml";
import { useEffect, useState } from "react";
import { Button, Card, Collapse, Intent, Text } from "@blueprintjs/core";
import type { NextPage } from "next";
import styles from "../styles/LabStatus.module.css";

interface GpuStats {
  [name: string]: {
    gpu_mem_usage: {
      total: string;
      used: string;
      free: string;
    };
    gpu_freq: {
      sm_clock: string;
      mem_clock: string;
    };
    gpu_temp: string;
    gpu_util: {
      gpu_util: string;
      memory_util: string;
      encoder_util: string;
      decoder_util: string;
    };
    gpu_processes: string;
    gpu_process_info: string;
    nvidia_driver: string;
    cuda_versions: string;
    cudnn_versions: string;
  };
}

interface AllGpuStats {
  [name: string]: GpuStats[];
}

interface GpuProc {
  pid: number;
  name: string;
  compute_instance_id: string | number;
  gpu_instance_id: string | number;
  type: string;
  used_memory: string;
  user: string;
  start_time: string;
  elapsed_time: string;
  command: string;
}

const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (event: any) => {
      setMousePosition({
        x: event.clientX,
        y: event.clientY,
      });
    };
    window.addEventListener("mousemove", updateMousePosition);

    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);

  return mousePosition;
};

const useWindowDimensions = () => {
  const [windowSize, setWindowSize] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({
        x: window.innerWidth,
        y: window.innerHeight,
      });
    };

    window.addEventListener("resize", updateWindowSize);
    updateWindowSize();

    return () => {
      window.removeEventListener("resize", updateWindowSize);
    };
  }, []);

  return windowSize;
};

const useEscape = (onEscape: any, onEscapeParams: any) => {
  useEffect(() => {
    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape" && typeof onEscape === "function") onEscape(onEscapeParams);
    });

    return () => {
      window.removeEventListener("keydown", (event) => {});
    };
  }, []);
};

const LabStatus: NextPage = () => {
  const [data, setData] = useState<AllGpuStats>();
  const [isLoading, setLoading] = useState(false);
  const [gpu_running_processes, setGpuRunningProcesses] = useState<GpuProc[]>([]);
  const [show_gpu_procs, setShowGpuProcs] = useState(false);
  const [show_gpu_procs_spawn_pos, setShowGpuProcsSpawnPos] = useState({
    x: 0,
    y: 0,
  });

  const cursor_pos = useMousePosition();
  const window_size = useWindowDimensions();
  const escape = useEscape(setShowGpuProcs, false);

  useEffect(() => {
    setLoading(true);
    fetch("lab_machine_status.yml")
      .then((res) => res.blob())
      .then((blob) => blob.text())
      .then((text) => YAML.parse(text))
      .then((data) => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (isLoading) return <p>Loading...</p>;
  if (!data) return <p>No profile data</p>;

  const extractInt = (strVal: string) => parseInt(strVal.split(" ")[0]);

  const isGpuAvailable = (gpu_name: string, memory_util: string) => {
    const availabilityClass =
      gpu_name == "UNAVAILABLE" ? "unavailable" : extractInt(memory_util) > 500 ? "inuse" : "available";
    return availabilityClass;
  };

  const getGpuRunningProcesses = (host_name: string, gpu_idx: number, gpu_name: string) => {
    const gpu_proc_str = data[host_name][gpu_idx][gpu_name].gpu_processes;
    const gpu_proc_info_str = data[host_name][gpu_idx][gpu_name].gpu_process_info;
    let processes: Array<any> = [JSON.parse(gpu_proc_str.replaceAll("'", '"')).process_info].flat();
    let processes_info = JSON.parse(gpu_proc_info_str.replaceAll("'", '"'));

    let gpu_proc_list: GpuProc[] = [];
    processes.map((proc) => {
      let gpu_proc: any = {};
      gpu_proc.pid = proc.pid;
      gpu_proc.name = proc.process_name;
      gpu_proc.compute_instance_id = proc.compute_instance_id;
      gpu_proc.gpu_instance_id = proc.gpu_instance_id;
      gpu_proc.type = proc.type;
      gpu_proc.used_memory = proc.used_memory;

      let proc_info: string[] = processes_info[gpu_proc.pid!].split(",");
      proc_info = proc_info.map((s) => s.trim());

      gpu_proc.user = proc_info[0];
      gpu_proc.start_time = proc_info[1];
      gpu_proc.elapsed_time = proc_info[2];
      gpu_proc.command = proc_info[3];

      gpu_proc_list.push(gpu_proc as GpuProc);
    });
    setGpuRunningProcesses(gpu_proc_list);
    setShowGpuProcs(true);
    setShowGpuProcsSpawnPos(cursor_pos);
  };

  const getProcTable = (gpu_running_processes: GpuProc[]) => (
    <table className={`${styles["proc-info-wrapper-table"]} bp4-html-table-condensed`}>
      <thead>
        <tr>
          <th>pid</th>
          <th>name</th>
          <th>used_memory</th>
          <th>user</th>
          <th>start_time</th>
          <th>elapsed_time</th>
          <th>command</th>
        </tr>
      </thead>
      <tbody>
        {gpu_running_processes.map((proc) => (
          <tr key={proc.pid}>
            <td>{proc.pid}</td>
            <td>{proc.name}</td>
            <td>{proc.used_memory}</td>
            <td>{proc.user}</td>
            <td>{proc.start_time}</td>
            <td>{proc.elapsed_time}</td>
            <td>
              <Text ellipsize={true} style={{ maxWidth: 300 }}>
                {proc.command}
              </Text>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <div
        className={`${styles["proc-info-wrapper"]}`}
        style={{
          transform: `translate(
            ${
              window_size.x - (show_gpu_procs_spawn_pos.x + 50) > 50
                ? show_gpu_procs_spawn_pos.x + 30
                : show_gpu_procs_spawn_pos.x - 50
            }px, 
            ${
              window_size.y - (show_gpu_procs_spawn_pos.y + 150) > 150
                ? show_gpu_procs_spawn_pos.y + 30
                : show_gpu_procs_spawn_pos.y - 150
            }px)`,
        }}
      >
        <Collapse isOpen={show_gpu_procs}>
          {getProcTable(gpu_running_processes)}
          <Button text="Close" fill={true} intent={Intent.WARNING} onClick={() => setShowGpuProcs(false)} />
        </Collapse>
      </div>

      <h1>Lab Machine Statuses</h1>

      <table className={`${styles["lab-status-table"]} bp4-html-table bp4-interactive`}>
        <thead>
          <tr>
            <th rowSpan={2}>machine</th>
            <th rowSpan={2}>gpu_type</th>
            <th colSpan={3}>gpu_mem_usage</th>
            <th colSpan={2}>gpu_freq</th>
            <th rowSpan={2}>gpu_temp</th>
            <th colSpan={4}>gpu_util</th>
            <th rowSpan={2}>nvidia_driver</th>
            <th rowSpan={2}>cuda_versions</th>
            <th rowSpan={2}>cudnn_versions</th>
          </tr>
          <tr>
            <th>Total</th>
            <th>Used</th>
            <th>Free</th>
            <th>SM</th>
            <th>Mem</th>
            <th>Total</th>
            <th>Mem</th>
            <th>Enc</th>
            <th>Dec</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data).map((host_name) =>
            data[host_name].map((host_obj, gpu_idx) =>
              Object.keys(host_obj).map((gpu_name) => (
                <tr
                  key="`${host_name}_${gpu_name}`"
                  className={styles[isGpuAvailable(gpu_name, host_obj[gpu_name].gpu_mem_usage.used)]}
                  onClick={(e) => getGpuRunningProcesses(host_name, gpu_idx, gpu_name)}
                >
                  {gpu_idx == 0 ? <th rowSpan={data[host_name].length}>{host_name}</th> : null}
                  <td>{gpu_name}</td>
                  <td>{host_obj[gpu_name].gpu_mem_usage.total}</td>
                  <td>{host_obj[gpu_name].gpu_mem_usage.used}</td>
                  <td>{host_obj[gpu_name].gpu_mem_usage.free}</td>
                  <td>{host_obj[gpu_name].gpu_freq.sm_clock}</td>
                  <td>{host_obj[gpu_name].gpu_freq.mem_clock}</td>
                  <td>{host_obj[gpu_name].gpu_temp}</td>
                  <td>{host_obj[gpu_name].gpu_util.gpu_util}</td>
                  <td>{host_obj[gpu_name].gpu_util.memory_util}</td>
                  <td>{host_obj[gpu_name].gpu_util.encoder_util}</td>
                  <td>{host_obj[gpu_name].gpu_util.decoder_util}</td>
                  <td>{host_obj[gpu_name].nvidia_driver}</td>
                  <td>{host_obj[gpu_name].cuda_versions}</td>
                  <td>{host_obj[gpu_name].cudnn_versions}</td>
                </tr>
              ))
            )
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LabStatus;
