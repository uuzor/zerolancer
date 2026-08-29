import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.js";
import { useConfig } from "./context/ConfigContext.js";
import Landing from "./pages/Landing.js";
import Login from "./pages/Login.js";
import Marketplace from "./pages/Marketplace.js";
import TaskDetail from "./pages/TaskDetail.js";
import TaskCreate from "./pages/TaskCreate.js";
import TaskWorkspace from "./pages/TaskWorkspace.js";
import FundEscrow from "./pages/FundEscrow.js";
import AssignFreelancer from "./pages/AssignFreelancer.js";
import SubmitDeliverable from "./pages/SubmitDeliverable.js";
import VerifyTask from "./pages/VerifyTask.js";
import TaskDispute from "./pages/TaskDispute.js";
import TaskReputation from "./pages/TaskReputation.js";
import Programs from "./pages/Programs.js";
import ProgramDetail from "./pages/ProgramDetail.js";
import WaveProgramCreate from "./pages/WaveProgramCreate.js";
import WaveProjects from "./pages/WaveProjects.js";
import ProjectDetail from "./pages/ProjectDetail.js";
import WaveApply from "./pages/WaveApply.js";
import WaveSubmit from "./pages/WaveSubmit.js";
import WaveAward from "./pages/WaveAward.js";
import Issues from "./pages/Issues.js";
import IssueDetail from "./pages/IssueDetail.js";
import IssueCreate from "./pages/IssueCreate.js";
import Buildathons from "./pages/Buildathons.js";
import BuildathonDetail from "./pages/BuildathonDetail.js";
import Reputation from "./pages/Reputation.js";
import ReputationDetail from "./pages/ReputationDetail.js";
import Disputes from "./pages/Disputes.js";
import DisputeDetail from "./pages/DisputeDetail.js";
import Github from "./pages/Github.js";
import GithubConnected from "./pages/GithubConnected.js";
import Settings from "./pages/Settings.js";
import MyTasks from "./pages/MyTasks.js";

export function AppRoutes() {
  const { connected } = useAuth();
  const config = useConfig();
  const hasWave = config.addresses.waveProgram && config.addresses.waveIssue && config.addresses.waveBuildathon;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/marketplace/tasks/:taskId" element={<TaskDetail />} />
      <Route path="/marketplace/waves/:programId" element={<ProgramDetail />} />
      <Route path="/tasks" element={<MyTasks />} />
      <Route path="/tasks/new" element={connected ? <TaskCreate /> : <Navigate to="/login" />} />
      <Route path="/tasks/:taskId" element={<TaskWorkspace />} />
      <Route path="/tasks/:taskId/fund" element={<FundEscrow />} />
      <Route path="/tasks/:taskId/assign" element={<AssignFreelancer />} />
      <Route path="/tasks/:taskId/submit" element={<SubmitDeliverable />} />
      <Route path="/tasks/:taskId/verify" element={<VerifyTask />} />
      <Route path="/tasks/:taskId/dispute" element={<TaskDispute />} />
      <Route path="/tasks/:taskId/reputation" element={<TaskReputation />} />
      <Route path="/programs" element={<Programs />} />
      <Route path="/programs/new" element={<WaveProgramCreate />} />
      <Route path="/programs/:programId" element={<ProgramDetail />} />
      <Route path="/programs/:programId/projects" element={<WaveProjects />} />
      <Route path="/programs/:programId/waves/:waveId/projects" element={<WaveProjects />} />
      <Route path="/programs/:programId/apply" element={<WaveApply />} />
      <Route path="/programs/:programId/waves/:waveId/submit" element={<WaveSubmit />} />
      <Route path="/programs/:programId/waves/:waveId/award" element={<WaveAward />} />
      <Route path="/project/:projectId" element={<ProjectDetail />} />
      {hasWave && <Route path="/issues" element={<Issues />} />}
      {hasWave && <Route path="/issues/new" element={<IssueCreate />} />}
      {hasWave && <Route path="/issues/:issueId" element={<IssueDetail />} />}
      {hasWave && <Route path="/buildathons" element={<Buildathons />} />}
      {hasWave && <Route path="/buildathons/:programId" element={<BuildathonDetail />} />}
      <Route path="/reputation" element={<Reputation />} />
      <Route path="/reputation/:address" element={<Reputation />} />
      <Route path="/reputation/:address/nft/:tokenId" element={<ReputationDetail />} />
      <Route path="/reputation/:address/stake" element={<ReputationDetail />} />
      <Route path="/disputes" element={<Disputes />} />
      <Route path="/disputes/:taskId" element={<DisputeDetail />} />
      <Route path="/github" element={<Github />} />
      <Route path="/github/connected" element={<GithubConnected />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
