import React from 'react';
import { WorkspaceTaskRow, type WorkspaceTaskRowProps } from './WorkspaceTaskRow';
export const TaskCard = React.memo<WorkspaceTaskRowProps>(props => <WorkspaceTaskRow {...props}/>);