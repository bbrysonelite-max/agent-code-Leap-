import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mail, MessageSquare, Plus, Search, Filter, Edit, Copy, BarChart3 } from 'lucide-react';
import { useContentTemplates, useCreateContentTemplate } from '../hooks/useNurturing';
import { useToast } from '@/components/ui/use-toast';
import LoadingSpinner from './LoadingSpinner';

export default function ContentTemplateManager() {
  const [filters, setFilters] = useState({
    type: 'all',
    classification: 'all',
    stage: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  const { data: templates, isLoading } = useContentTemplates(
    filters.type === 'all' ? undefined : filters
  );
  const { toast } = useToast();

  const filteredTemplates = templates?.filter(template => 
    searchTerm === '' || 
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.content.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'social': return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-500';
      case 'sms': return 'bg-green-500';
      case 'social': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Templates</h2>
          <p className="text-muted-foreground">
            Manage personalized content templates for nurturing sequences
          </p>
        </div>
        <Button onClick={() => setShowCreateTemplate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select 
          value={filters.type} 
          onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="social">Social</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.classification} 
          onValueChange={(value) => setFilters(prev => ({ ...prev, classification: value }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="nurture">Nurture</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.stage} 
          onValueChange={(value) => setFilters(prev => ({ ...prev, stage: value }))}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="awareness">Awareness</SelectItem>
            <SelectItem value="interest">Interest</SelectItem>
            <SelectItem value="consideration">Consideration</SelectItem>
            <SelectItem value="intent">Intent</SelectItem>
            <SelectItem value="evaluation">Evaluation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || Object.values(filters).some(v => v !== 'all')
                ? 'No templates match your filters'
                : 'Create your first content template to get started'
              }
            </p>
            {!searchTerm && Object.values(filters).every(v => v === 'all') && (
              <Button onClick={() => setShowCreateTemplate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard 
              key={template.id} 
              template={template}
              onEdit={() => {}}
              onDuplicate={() => {}}
            />
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      {showCreateTemplate && (
        <CreateTemplateDialog onClose={() => setShowCreateTemplate(false)} />
      )}
    </div>
  );
}

function TemplateCard({ 
  template, 
  onEdit, 
  onDuplicate 
}: { 
  template: any;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'social': return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-500';
      case 'sms': return 'bg-green-500';
      case 'social': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded ${getTypeColor(template.type)} text-white`}>
              {getTypeIcon(template.type)}
            </div>
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <Badge variant="outline" className="mt-1">
                {template.type}
              </Badge>
            </div>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Target Criteria */}
        <div>
          <h4 className="text-sm font-medium mb-2">Target Criteria</h4>
          <div className="flex flex-wrap gap-1">
            {template.classification.map((classification: string) => (
              <Badge key={classification} variant="outline" className="text-xs">
                {classification}
              </Badge>
            ))}
            {template.stages.map((stage: string) => (
              <Badge key={stage} variant="outline" className="text-xs">
                {stage}
              </Badge>
            ))}
          </div>
        </div>

        {/* Content Preview */}
        <div>
          <h4 className="text-sm font-medium mb-2">Content Preview</h4>
          {template.subject && (
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Subject: {template.subject.substring(0, 50)}...
            </p>
          )}
          <p className="text-sm text-muted-foreground line-clamp-3">
            {template.content.substring(0, 120)}...
          </p>
        </div>

        {/* Variables */}
        {template.variables.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Variables</h4>
            <div className="flex flex-wrap gap-1">
              {template.variables.slice(0, 3).map((variable: string) => (
                <Badge key={variable} variant="secondary" className="text-xs">
                  {variable}
                </Badge>
              ))}
              {template.variables.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.variables.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Performance */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1">
              <BarChart3 className="h-3 w-3" />
              <span className="text-muted-foreground">Performance</span>
            </div>
            <div className="text-right">
              <div className="font-medium">
                {Math.round(template.performance.responseRate * 100)}% response
              </div>
              <div className="text-xs text-muted-foreground">
                {template.performance.sentCount} sent
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTemplateDialog({ onClose }: { onClose: () => void }) {
  const [templateData, setTemplateData] = useState({
    name: '',
    type: 'email',
    subject: '',
    content: '',
    classification: [] as string[],
    stages: [] as string[],
    industry: '',
    persona: ''
  });

  const createTemplate = useCreateContentTemplate();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!templateData.name || !templateData.content) {
      toast({
        title: "Validation Error",
        description: "Please provide a name and content for the template",
        variant: "destructive"
      });
      return;
    }

    try {
      // Extract variables from content
      const variables = extractVariables(templateData.content + (templateData.subject || ''));
      
      await createTemplate.mutateAsync({
        ...templateData,
        variables
      });
      
      toast({
        title: "Success",
        description: "Content template created successfully"
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive"
      });
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/{{(\w+)}}/g);
    if (!matches) return [];
    
    return [...new Set(matches.map(match => match.slice(2, -2)))];
  };

  const classifications = ['hot', 'warm', 'nurture', 'cold'];
  const stages = ['awareness', 'interest', 'consideration', 'intent', 'evaluation'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Content Template</DialogTitle>
          <DialogDescription>
            Create a new personalized content template for nurturing sequences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={templateData.name}
                onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Hot Lead Follow-up"
              />
            </div>
            
            <div>
              <Label htmlFor="type">Content Type</Label>
              <Select 
                value={templateData.type} 
                onValueChange={(value) => setTemplateData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {templateData.type === 'email' && (
            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={templateData.subject}
                onChange={(e) => setTemplateData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="{{firstName}}, quick question about {{company}}"
              />
            </div>
          )}

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={templateData.content}
              onChange={(e) => setTemplateData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Hi {{firstName}}, I noticed you're in {{industry}}..."
              rows={8}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use variables like {{firstName}}, {{company}}, {{classification}} for personalization
            </p>
          </div>

          <div>
            <Label className="text-base font-medium mb-3 block">Target Classifications</Label>
            <div className="grid grid-cols-2 gap-2">
              {classifications.map((classification) => (
                <label
                  key={classification}
                  className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={templateData.classification.includes(classification)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTemplateData(prev => ({
                          ...prev,
                          classification: [...prev.classification, classification]
                        }));
                      } else {
                        setTemplateData(prev => ({
                          ...prev,
                          classification: prev.classification.filter(c => c !== classification)
                        }));
                      }
                    }}
                  />
                  <Badge variant="outline">{classification}</Badge>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-base font-medium mb-3 block">Target Stages</Label>
            <div className="grid grid-cols-2 gap-2">
              {stages.map((stage) => (
                <label
                  key={stage}
                  className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={templateData.stages.includes(stage)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTemplateData(prev => ({
                          ...prev,
                          stages: [...prev.stages, stage]
                        }));
                      } else {
                        setTemplateData(prev => ({
                          ...prev,
                          stages: prev.stages.filter(s => s !== stage)
                        }));
                      }
                    }}
                  />
                  <Badge variant="outline">{stage}</Badge>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createTemplate.isPending}>
            {createTemplate.isPending ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}