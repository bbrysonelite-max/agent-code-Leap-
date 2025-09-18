import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit, Settings, Users, Target, MessageSquare } from 'lucide-react';
import backend from '~backend/client';
import type { 
  ClientConfiguration, 
  BusinessType, 
  ProspectType, 
  CreateClientRequest,
  UpdateClientRequest 
} from '~backend/client/types';

const businessTypes: { value: BusinessType; label: string; description: string }[] = [
  { value: 'network_marketing', label: 'Network Marketing', description: 'Multi-level marketing business model' },
  { value: 'direct_sales', label: 'Direct Sales', description: 'Direct-to-consumer sales' },
  { value: 'real_estate', label: 'Real Estate', description: 'Property sales and rentals' },
  { value: 'insurance', label: 'Insurance', description: 'Insurance sales and services' },
  { value: 'consulting', label: 'Consulting', description: 'Professional consulting services' },
  { value: 'coaching', label: 'Coaching', description: 'Life, business, or career coaching' },
  { value: 'ecommerce', label: 'E-commerce', description: 'Online retail business' },
  { value: 'saas', label: 'SaaS', description: 'Software as a Service' },
  { value: 'recruitment', label: 'Recruitment', description: 'Talent acquisition and placement' },
  { value: 'custom', label: 'Custom', description: 'Custom business model' },
];

const prospectTypes: { value: ProspectType; label: string; description: string }[] = [
  { value: 'customer', label: 'Customers', description: 'Potential buyers of products/services' },
  { value: 'distributor', label: 'Distributors', description: 'People to recruit as distributors' },
  { value: 'business_builder', label: 'Business Builders', description: 'Entrepreneurs looking to build a business' },
  { value: 'recruits', label: 'Recruits', description: 'General recruitment prospects' },
  { value: 'leads', label: 'Leads', description: 'General sales leads' },
  { value: 'referrals', label: 'Referrals', description: 'Referral sources and partners' },
  { value: 'partners', label: 'Partners', description: 'Business partnership opportunities' },
  { value: 'clients', label: 'Clients', description: 'Service clients and customers' },
  { value: 'custom', label: 'Custom', description: 'Custom prospect type' },
];

const tones = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
] as const;

interface ClientFormData {
  client_name: string;
  business_type: BusinessType;
  business_description: string;
  enabled_prospect_types: ProspectType[];
  search_config: {
    target_industries: string[];
    target_positions: string[];
    company_size_range: { min: number; max: number };
    location_preferences: string[];
    exclude_keywords: string[];
    include_keywords: string[];
  };
  messaging_config: {
    brand_name: string;
    value_proposition: string;
    tone: 'professional' | 'casual' | 'friendly' | 'formal';
    primary_goal: string;
  };
  daily_limits: {
    max_prospects_per_day: number;
    max_emails_per_day: number;
  };
}

export default function ClientManagement() {
  const [clients, setClients] = useState<ClientConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<ClientConfiguration | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<ClientFormData>({
    client_name: '',
    business_type: 'network_marketing',
    business_description: '',
    enabled_prospect_types: ['customer'],
    search_config: {
      target_industries: [],
      target_positions: [],
      company_size_range: { min: 1, max: 1000 },
      location_preferences: [],
      exclude_keywords: [],
      include_keywords: [],
    },
    messaging_config: {
      brand_name: '',
      value_proposition: '',
      tone: 'professional',
      primary_goal: '',
    },
    daily_limits: {
      max_prospects_per_day: 50,
      max_emails_per_day: 100,
    },
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await backend.client.list({});
      setClients(response.clients);
    } catch (error) {
      console.error('Failed to load clients:', error);
      toast({
        title: 'Error',
        description: 'Failed to load client configurations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    try {
      const newClient = await backend.client.create(formData as CreateClientRequest);
      setClients([newClient, ...clients]);
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Client configuration created successfully',
      });
    } catch (error) {
      console.error('Failed to create client:', error);
      toast({
        title: 'Error',
        description: 'Failed to create client configuration',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateClient = async () => {
    if (!selectedClient) return;
    
    try {
      const updateData: UpdateClientRequest = {
        id: selectedClient.id,
        client_name: formData.client_name,
        business_type: formData.business_type,
        business_description: formData.business_description,
        enabled_prospect_types: formData.enabled_prospect_types,
        search_config: formData.search_config,
        messaging_config: formData.messaging_config,
        daily_limits: formData.daily_limits,
      };
      
      const updatedClient = await backend.client.update(updateData);
      
      setClients(clients.map(c => c.id === selectedClient.id ? updatedClient : c));
      setIsEditDialogOpen(false);
      setSelectedClient(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'Client configuration updated successfully',
      });
    } catch (error) {
      console.error('Failed to update client:', error);
      toast({
        title: 'Error',
        description: 'Failed to update client configuration',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      client_name: '',
      business_type: 'network_marketing',
      business_description: '',
      enabled_prospect_types: ['customer'],
      search_config: {
        target_industries: [],
        target_positions: [],
        company_size_range: { min: 1, max: 1000 },
        location_preferences: [],
        exclude_keywords: [],
        include_keywords: [],
      },
      messaging_config: {
        brand_name: '',
        value_proposition: '',
        tone: 'professional',
        primary_goal: '',
      },
      daily_limits: {
        max_prospects_per_day: 50,
        max_emails_per_day: 100,
      },
    });
  };

  const openEditDialog = (client: ClientConfiguration) => {
    setSelectedClient(client);
    setFormData({
      client_name: client.client_name,
      business_type: client.business_type,
      business_description: client.business_description || '',
      enabled_prospect_types: client.enabled_prospect_types,
      search_config: client.search_config,
      messaging_config: client.messaging_config,
      daily_limits: client.daily_limits,
    });
    setIsEditDialogOpen(true);
  };

  const handleProspectTypeToggle = (type: ProspectType) => {
    const current = formData.enabled_prospect_types;
    if (current.includes(type)) {
      setFormData({
        ...formData,
        enabled_prospect_types: current.filter(t => t !== type),
      });
    } else {
      setFormData({
        ...formData,
        enabled_prospect_types: [...current, type],
      });
    }
  };

  const addStringToArray = (array: string[], value: string, key: string) => {
    if (value.trim()) {
      setFormData({
        ...formData,
        search_config: {
          ...formData.search_config,
          [key]: [...array, value.trim()],
        },
      });
    }
  };

  const removeStringFromArray = (array: string[], index: number, key: string) => {
    setFormData({
      ...formData,
      search_config: {
        ...formData.search_config,
        [key]: array.filter((_, i) => i !== index),
      },
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">
            Configure different clients and their business-specific prospect targeting
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Client Configuration</DialogTitle>
            </DialogHeader>
            <ClientForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreateClient}
              onProspectTypeToggle={handleProspectTypeToggle}
              addStringToArray={addStringToArray}
              removeStringFromArray={removeStringFromArray}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Card key={client.id} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {client.messaging_config.brand_name}
                    {!client.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </CardTitle>
                  <CardDescription>{client.client_name}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(client)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Business Type</p>
                <Badge variant="outline">
                  {businessTypes.find(t => t.value === client.business_type)?.label}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-2">Prospect Types</p>
                <div className="flex flex-wrap gap-1">
                  {client.enabled_prospect_types.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {prospectTypes.find(t => t.value === type)?.label}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium">Primary Goal</p>
                <p className="text-sm text-muted-foreground">
                  {client.messaging_config.primary_goal}
                </p>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Daily Limits:</span>
                <span>
                  {client.daily_limits.max_prospects_per_day} prospects, 
                  {client.daily_limits.max_emails_per_day} emails
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client Configuration</DialogTitle>
          </DialogHeader>
          <ClientForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateClient}
            onProspectTypeToggle={handleProspectTypeToggle}
            addStringToArray={addStringToArray}
            removeStringFromArray={removeStringFromArray}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ClientFormProps {
  formData: ClientFormData;
  setFormData: (data: ClientFormData) => void;
  onSubmit: () => void;
  onProspectTypeToggle: (type: ProspectType) => void;
  addStringToArray: (array: string[], value: string, key: string) => void;
  removeStringFromArray: (array: string[], index: number, key: string) => void;
  isEdit?: boolean;
}

function ClientForm({
  formData,
  setFormData,
  onSubmit,
  onProspectTypeToggle,
  addStringToArray,
  removeStringFromArray,
  isEdit = false,
}: ClientFormProps) {
  const [newIndustry, setNewIndustry] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newIncludeKeyword, setNewIncludeKeyword] = useState('');
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('');

  return (
    <Tabs defaultValue="basic" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="basic">
          <Settings className="h-4 w-4 mr-2" />
          Basic
        </TabsTrigger>
        <TabsTrigger value="prospects">
          <Users className="h-4 w-4 mr-2" />
          Prospects
        </TabsTrigger>
        <TabsTrigger value="search">
          <Target className="h-4 w-4 mr-2" />
          Search
        </TabsTrigger>
        <TabsTrigger value="messaging">
          <MessageSquare className="h-4 w-4 mr-2" />
          Messaging
        </TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="client_name">Client Name</Label>
            <Input
              id="client_name"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              placeholder="e.g., Brent's NuSkin Business"
            />
          </div>
          <div>
            <Label htmlFor="business_type">Business Type</Label>
            <Select 
              value={formData.business_type}
              onValueChange={(value: BusinessType) => 
                setFormData({ ...formData, business_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businessTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label htmlFor="business_description">Business Description (Optional)</Label>
          <Textarea
            id="business_description"
            value={formData.business_description}
            onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
            placeholder="Describe your business model and what makes it unique..."
          />
        </div>
      </TabsContent>

      <TabsContent value="prospects" className="space-y-4">
        <div>
          <Label>Prospect Types to Target</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Select the types of prospects you want to find and recruit
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {prospectTypes.map((type) => (
              <div key={type.value} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  checked={formData.enabled_prospect_types.includes(type.value)}
                  onCheckedChange={() => onProspectTypeToggle(type.value)}
                />
                <div className="flex-1">
                  <Label className="font-medium">{type.label}</Label>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="search" className="space-y-4">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Target Industries</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  placeholder="e.g., Health & Wellness"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addStringToArray(formData.search_config.target_industries, newIndustry, 'target_industries');
                      setNewIndustry('');
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addStringToArray(formData.search_config.target_industries, newIndustry, 'target_industries');
                    setNewIndustry('');
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.search_config.target_industries.map((industry, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" 
                         onClick={() => removeStringFromArray(formData.search_config.target_industries, index, 'target_industries')}>
                    {industry} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Target Positions</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder="e.g., Marketing Manager"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addStringToArray(formData.search_config.target_positions, newPosition, 'target_positions');
                      setNewPosition('');
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addStringToArray(formData.search_config.target_positions, newPosition, 'target_positions');
                    setNewPosition('');
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.search_config.target_positions.map((position, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer"
                         onClick={() => removeStringFromArray(formData.search_config.target_positions, index, 'target_positions')}>
                    {position} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Company Size Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Min Employees</Label>
                <Input
                  type="number"
                  value={formData.search_config.company_size_range.min}
                  onChange={(e) => setFormData({
                    ...formData,
                    search_config: {
                      ...formData.search_config,
                      company_size_range: {
                        ...formData.search_config.company_size_range,
                        min: parseInt(e.target.value) || 1,
                      },
                    },
                  })}
                />
              </div>
              <div>
                <Label className="text-sm">Max Employees</Label>
                <Input
                  type="number"
                  value={formData.search_config.company_size_range.max}
                  onChange={(e) => setFormData({
                    ...formData,
                    search_config: {
                      ...formData.search_config,
                      company_size_range: {
                        ...formData.search_config.company_size_range,
                        max: parseInt(e.target.value) || 1000,
                      },
                    },
                  })}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Location Preferences</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g., United States"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addStringToArray(formData.search_config.location_preferences, newLocation, 'location_preferences');
                      setNewLocation('');
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addStringToArray(formData.search_config.location_preferences, newLocation, 'location_preferences');
                    setNewLocation('');
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.search_config.location_preferences.map((location, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer"
                         onClick={() => removeStringFromArray(formData.search_config.location_preferences, index, 'location_preferences')}>
                    {location} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Include Keywords</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newIncludeKeyword}
                  onChange={(e) => setNewIncludeKeyword(e.target.value)}
                  placeholder="e.g., entrepreneur"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addStringToArray(formData.search_config.include_keywords, newIncludeKeyword, 'include_keywords');
                      setNewIncludeKeyword('');
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addStringToArray(formData.search_config.include_keywords, newIncludeKeyword, 'include_keywords');
                    setNewIncludeKeyword('');
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.search_config.include_keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer"
                         onClick={() => removeStringFromArray(formData.search_config.include_keywords, index, 'include_keywords')}>
                    {keyword} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Exclude Keywords</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newExcludeKeyword}
                  onChange={(e) => setNewExcludeKeyword(e.target.value)}
                  placeholder="e.g., student"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addStringToArray(formData.search_config.exclude_keywords, newExcludeKeyword, 'exclude_keywords');
                      setNewExcludeKeyword('');
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addStringToArray(formData.search_config.exclude_keywords, newExcludeKeyword, 'exclude_keywords');
                    setNewExcludeKeyword('');
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.search_config.exclude_keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer"
                         onClick={() => removeStringFromArray(formData.search_config.exclude_keywords, index, 'exclude_keywords')}>
                    {keyword} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="messaging" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="brand_name">Brand Name</Label>
            <Input
              id="brand_name"
              value={formData.messaging_config.brand_name}
              onChange={(e) => setFormData({
                ...formData,
                messaging_config: { ...formData.messaging_config, brand_name: e.target.value },
              })}
              placeholder="e.g., NuSkin"
            />
          </div>
          <div>
            <Label htmlFor="tone">Communication Tone</Label>
            <Select 
              value={formData.messaging_config.tone}
              onValueChange={(value: 'professional' | 'casual' | 'friendly' | 'formal') => 
                setFormData({
                  ...formData,
                  messaging_config: { ...formData.messaging_config, tone: value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tones.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="value_proposition">Value Proposition</Label>
          <Textarea
            id="value_proposition"
            value={formData.messaging_config.value_proposition}
            onChange={(e) => setFormData({
              ...formData,
              messaging_config: { ...formData.messaging_config, value_proposition: e.target.value },
            })}
            placeholder="What value do you offer to prospects? What makes your opportunity unique?"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="primary_goal">Primary Goal</Label>
          <Input
            id="primary_goal"
            value={formData.messaging_config.primary_goal}
            onChange={(e) => setFormData({
              ...formData,
              messaging_config: { ...formData.messaging_config, primary_goal: e.target.value },
            })}
            placeholder="e.g., recruit distributors, find customers, generate leads"
          />
        </div>

        <Separator />

        <div>
          <Label>Daily Limits</Label>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="max_prospects">Max Prospects per Day</Label>
              <Input
                id="max_prospects"
                type="number"
                value={formData.daily_limits.max_prospects_per_day}
                onChange={(e) => setFormData({
                  ...formData,
                  daily_limits: {
                    ...formData.daily_limits,
                    max_prospects_per_day: parseInt(e.target.value) || 50,
                  },
                })}
              />
            </div>
            <div>
              <Label htmlFor="max_emails">Max Emails per Day</Label>
              <Input
                id="max_emails"
                type="number"
                value={formData.daily_limits.max_emails_per_day}
                onChange={(e) => setFormData({
                  ...formData,
                  daily_limits: {
                    ...formData.daily_limits,
                    max_emails_per_day: parseInt(e.target.value) || 100,
                  },
                })}
              />
            </div>
          </div>
        </div>
      </TabsContent>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={() => {}}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update Client' : 'Create Client'}
        </Button>
      </div>
    </Tabs>
  );
}