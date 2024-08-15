import "./App.css";
import {
  Layout,
  Row,
  Col,
  Button,
  Spin,
  List,
  Checkbox,
  Input,
  Space,
} from "antd";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import {
  useWallet,
  InputTransactionData,
} from "@aptos-labs/wallet-adapter-react";

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { useEffect, useState } from "react";
import { CheckboxChangeEvent } from "antd/es/checkbox";

const aptosConfig = new AptosConfig({ network: Network.DEVNET });
export const aptos = new Aptos(aptosConfig);
export const moduleAddress =
  "c9946781d09715fccb12d9544ce87453921bca802ea3cfb6262fd758f3c43ac4";

type Task = {
  address: string;
  completed: boolean;
  content: string;
  task_id: string;
};

function App() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [accountHasList, setAccountHasList] = useState<boolean>(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<string>("");

  const onWriteTask = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setNewTask(value);
  };

  const addNewTask = async () => {
    // check if wallet is connected
    if (!account) return [];

    // check if task is empty
    if (!newTask) {
      alert("Task cannot be empty");
      return [];
    }

    // set transaction in progress
    setTransactionInProgress(true);

    // createNewTask object
    const taskId =
      tasks.length > 0 ? parseInt(tasks[tasks.length - 1].task_id) + 1 : 1;
    const newTaskObj: Task = {
      address: account.address,
      completed: false,
      content: newTask,
      task_id: taskId.toString(),
    };

    // create transaction object
    const transaction: InputTransactionData = {
      sender: account?.address,
      data: {
        function: `${moduleAddress}::todolist::create_task`,
        functionArguments: [newTask],
      },
    };

    try {
      const txnResp = await signAndSubmitTransaction(transaction);
      console.log("txnResp", txnResp);
      const report = await aptos.waitForTransaction({
        transactionHash: txnResp.hash,
      });
      console.log("report", report);

      // update local state
      setTasks([...tasks, newTaskObj]);

      // reset new task input
      setNewTask("");
    } catch (error: any) {
      console.error(error);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const completeTask = async (e: CheckboxChangeEvent, taskId: string) => {
    // check if wallet is connected
    if (!account) return [];

    // set transaction in progress
    setTransactionInProgress(true);

    // create transaction object
    const transaction: InputTransactionData = {
      sender: account?.address,
      data: {
        function: `0x${moduleAddress}::todolist::complete_task`,
        functionArguments: [taskId],
      },
    };

    try {
      const txnResp = await signAndSubmitTransaction(transaction);
      console.log("txnResp", txnResp);
      const report = await aptos.waitForTransaction({
        transactionHash: txnResp.hash,
      });
      console.log("report", report);

      // update local state
      const updatedTasks = tasks.map((task) => {
        if (task.task_id === taskId) {
          task.completed = e.target.checked;
        }
        return task;
      });

      setTasks(updatedTasks);
    } catch (error: any) {
      console.error(error);
    } finally {
      setTransactionInProgress(false);
    }
  };

  // for spinner when txn in in progress
  const [transactionInProgress, setTransactionInProgress] =
    useState<boolean>(false);

  useEffect(() => {
    fetchList();
  }, [account?.address]);

  const fetchList = async () => {
    if (!account) {
      // when account is not connected with the dapp
      return [];
    }
    console.log("fetaching list");
    try {
      // in move file todolist_addr::todolist
      const todoListResource = await aptos.getAccountResource({
        accountAddress: account?.address,
        resourceType: `0x${moduleAddress}::todolist::TodoList`,
      });
      setAccountHasList(true);
      console.log("got todoListResource", todoListResource);

      const tableHandle = (todoListResource as any).tasks.handle;
      // tasks table counter
      const taskCounter = (todoListResource as any).task_counter;
      let tasks = [];
      let counter = 1;
      while (counter <= taskCounter) {
        const tableItem = {
          key_type: "u64",
          value_type: `0x${moduleAddress}::todolist::Task`,
          key: `${counter}`,
        };
        const task = await aptos.getTableItem<Task>({
          handle: tableHandle,
          data: tableItem,
        });
        tasks.push(task);
        counter++;
      }
      // set tasks in local state
      setTasks(tasks);
    } catch (e: any) {
      console.error(e);
      setAccountHasList(false);
    }
  };

  const createNewList = async () => {
    if (!account) return [];
    setTransactionInProgress(true);
    console.log("creating new list");
    const transaction: InputTransactionData = {
      sender: account.address,
      data: {
        function: `${moduleAddress}::todolist::create_list`,
        functionArguments: [],
      },
    };

    console.log("transaction", transaction);
    try {
      // sign and submit transaction to chain
      const response = await signAndSubmitTransaction(transaction);
      console.log("response", response);
      // wait for transaction
      const resport = await aptos.waitForTransaction({
        transactionHash: response.hash,
      });
      console.log("resport", resport);
      setAccountHasList(true);
      setTransactionInProgress(false);
    } catch (error: any) {
      console.error(error);
      setAccountHasList(false);
      setTransactionInProgress(false);
    }
  };

  return (
    <div className="App">
      <Layout>
        <Row align="middle">
          <Col span={10} offset={2}>
            <h1>Aptos ToDo list</h1>
          </Col>
          <Col span={12} style={{ textAlign: "right", paddingRight: "200px" }}>
            <WalletSelector />
          </Col>
        </Row>
      </Layout>
      <Spin spinning={transactionInProgress}>
        {!accountHasList ? (
          <Row gutter={[0, 32]} style={{ marginTop: "2rem" }}>
            <Col span={8} offset={8}>
              <Button
                onClick={createNewList}
                block
                type="primary"
                style={{ height: "40px", backgroundColor: "#3f67ff" }}
              >
                Create new list
              </Button>
            </Col>
          </Row>
        ) : (
          <Row gutter={[0, 32]} style={{ marginTop: "2rem" }}>
            <Col span={8} offset={8}>
              <Space.Compact>
                <Input
                  onChange={(event) => onWriteTask(event)}
                  style={{ width: "calc(100% - 60px)" }}
                  placeholder="Add a Task"
                  size="large"
                  value={newTask}
                />
                <Button
                  type="primary"
                  style={{ height: "40px", backgroundColor: "#3f67ff" }}
                  onClick={addNewTask}
                >
                  Add
                </Button>
              </Space.Compact>
            </Col>
            <Col span={8} offset={8}>
              {tasks && (
                <List
                  size="small"
                  bordered
                  dataSource={tasks}
                  renderItem={(task: any) => (
                    <List.Item
                      actions={[
                        <Checkbox
                          onChange={(event) => {
                            completeTask(event, task.task_id);
                          }}
                          checked={task.completed}
                          disabled={task.completed}
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        title={task.content}
                        description={
                          <a
                            href={`https://explorer.aptoslabs.com/account/${task.address}/`}
                            target="_blank"
                          >{`${task.address.slice(0, 6)}...${task.address.slice(
                            -5
                          )}`}</a>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Col>
          </Row>
        )}
      </Spin>
    </div>
  );
}

export default App;
