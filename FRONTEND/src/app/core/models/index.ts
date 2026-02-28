// ============= CORE DOMAIN MODELS =============
// Compatible with: PostgreSQL, TimescaleDB, InfluxDB, Redis, Kafka

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  department: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'locked';
  skills?: string[];
  certifications?: string[];
  lastLogin?: Date;
  createdAt: Date;
}

export type UserRole = 'super_admin' | 'factory_manager' | 'maintenance_manager' | 'maintenance_engineer' | 'technician' | 'data_scientist' | 'quality_inspector' | 'viewer';

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface Equipment {
  id: string;
  assetId: string;
  name: string;
  serialNumber: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  yearManufactured: number;
  location: EquipmentLocation;
  specs: EquipmentSpecs;
  status: EquipmentStatus;
  healthScore: number;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  sensors: Sensor[];
  imageUrl?: string;
  qrCode?: string;
  createdAt: string;
}

export type EquipmentType = 'cnc_machine' | 'press' | 'conveyor' | 'pump' | 'compressor' | 'robot' | 'motor' | 'generator' | 'valve' | 'heat_exchanger';
export type EquipmentStatus = 'running' | 'warning' | 'critical' | 'maintenance' | 'offline' | 'idle';

export interface EquipmentLocation {
  building: string;
  floor: string;
  productionLine: string;
  workstation: string;
  coordinates?: { lat: number; lng: number };
}

export interface EquipmentSpecs {
  power: string;
  ratedSpeed?: string;
  maxTemperature?: number;
  maxPressure?: number;
  weight?: string;
}

export interface Sensor {
  id: string;
  equipmentId: string;
  name: string;
  type: SensorType;
  unit: string;
  currentValue: number;
  minThreshold: number;
  maxThreshold: number;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  status: 'normal' | 'warning' | 'critical';
  lastUpdated: string;
  sparklineData?: number[];
}

export type SensorType = 'temperature' | 'vibration' | 'pressure' | 'current' | 'humidity' | 'flow_rate' | 'rpm' | 'noise';

export interface SensorReading {
  sensorId: string;
  equipmentId: string;
  value: number;
  unit: string;
  timestamp: string;
  qualityFlag: 'good' | 'uncertain' | 'bad';
}

export interface Alert {
  id: string;
  equipmentId: string;
  equipmentName: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  assignedTo?: string;
  slaDeadline?: string;
  aiExplanation?: string;
  contributingFactors?: { factor: string; impact: number }[];
  recommendedActions?: string[];
  relatedAlerts?: string[];
  productionLine?: string;
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertType = 'sensor_threshold' | 'ml_prediction' | 'system' | 'manual';
export type AlertStatus = 'open' | 'acknowledged' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'escalated';

export interface WorkOrder {
  id: string;
  woNumber: string;
  title: string;
  description: string;
  type: MaintenanceType;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: WorkOrderStatus;
  equipmentId: string;
  equipmentName: string;
  assignedTo: string;
  assignedTeam?: string;
  createdBy: string;
  createdAt: string;
  deadline: string;
  estimatedHours: number;
  actualHours?: number;
  completionRate: number;
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
  checklist?: ChecklistItem[];
  workLogs?: WorkLog[];
  alertId?: string;
}

export type MaintenanceType = 'preventive' | 'predictive' | 'corrective' | 'emergency';
export type WorkOrderStatus = 'draft' | 'submitted' | 'approved' | 'scheduled' | 'assigned' | 'in_progress' | 'pending_parts' | 'completed' | 'verified' | 'closed';

export interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface WorkLog {
  id: string;
  timestamp: string;
  author: string;
  description: string;
  type: 'note' | 'status_change' | 'photo' | 'measurement';
}

export interface MaintenanceSchedule {
  id: string;
  title: string;
  type: MaintenanceType;
  equipmentId: string;
  equipmentName: string;
  productionLine: string;
  startDate: string;
  endDate: string;
  assignedTeam: string;
  status: 'planned' | 'in_progress' | 'completed' | 'overdue';
  completionRate: number;
  isAiRecommended: boolean;
  confidence?: number;
}

export interface SparePart {
  id: string;
  partNumber: string;
  name: string;
  description: string;
  manufacturer: string;
  category: string;
  unit: string;
  quantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  leadTimeDays: number;
  unitPrice: number;
  status: 'ok' | 'low_stock' | 'out_of_stock' | 'overstock';
  abcClass: 'A' | 'B' | 'C';
  compatibleEquipment: string[];
  lastUsedDate?: string;
}

export interface AIModel {
  id: string;
  name: string;
  version: string;
  type: 'health_score' | 'rul' | 'failure_prediction' | 'anomaly_detection';
  status: 'active' | 'staging' | 'deprecated' | 'training';
  accuracy: number;
  f1Score: number;
  precision: number;
  recall: number;
  deployedAt: string;
  trainedOn: string;
  datasetSize: number;
  features: string[];
  driftScore?: number;
  confidenceScore: number;
}

export interface Pipeline {
  id: string;
  name: string;
  type: 'train' | 'evaluate' | 'deploy' | 'monitor';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  triggeredBy: string;
  modelId?: string;
  metrics?: Record<string, number>;
}

export interface KPIData {
  oee: number;
  oeeTrend: number;
  mttr: number;
  mttrTrend: number;
  openAlerts: number;
  criticalAlerts: number;
  uptime: number;
  costSavings: number;
  totalEquipment: number;
  onlineEquipment: number;
}

export interface FactoryConfig {
  id: string;
  name: string;
  buildings: BuildingConfig[];
  shifts: ShiftConfig[];
  timezone: string;
  currency: string;
  language: string;
}

export interface BuildingConfig {
  id: string;
  name: string;
  floors: FloorConfig[];
}

export interface FloorConfig {
  id: string;
  name: string;
  productionLines: ProductionLineConfig[];
}

export interface ProductionLineConfig {
  id: string;
  name: string;
  workstations: string[];
}

export interface ShiftConfig {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'push' | 'in_app' | 'teams' | 'slack';
  subject?: string;
  body: string;
  severity: AlertSeverity;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  timestamp: string;
  dataBefore?: any;
  dataAfter?: any;
}
